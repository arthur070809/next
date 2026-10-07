import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import {
  areFaceTemplateVersionsCompatible,
  bestFaceMatchPerEmployee,
  decryptEmbedding,
  faceEmbeddingDistance,
  FaceRecognitionUnavailableError,
  getFaceIdentifyMinMargin,
  getFaceMatchThreshold,
  hashFaceNonce,
  isFaceEmbeddingMatch,
  validateFaceEmbedding,
} from "@/lib/face";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  loginAttemptStorageUnavailableResponse,
  recordLoginFailure,
} from "@/lib/login-attempts";
import { createLoginSessionResponse, getLoginAccessArea, verifyIdentifyFaceState } from "@/lib/login-flow";
import { isFaceLoginEnabled } from "@/lib/facial/config";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { createSecret, hashSecret } from "@/lib/webauthn";

const genericFailure = () => NextResponse.json({ error: "Não foi possível identificar com segurança. Use o crachá." }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });

export async function POST(request: Request) {
  try {
    if (!isFaceLoginEnabled()) return genericFailure();
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 32 * 1024)) {
      return genericFailure();
    }
    const ipHash = getLoginClientIpHash(request);
    if (isRateLimited(`face-identify:${ipHash}`, 9, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return genericFailure();
    }

    const challengeId = typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const loginToken = typeof body.loginToken === "string" ? body.loginToken.trim() : "";
    const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
    let candidate: number[] | null = null;
    try {
      if (body.challengeCompleted === true) candidate = validateFaceEmbedding(body.embedding);
    } catch {
      candidate = null;
    }
    if (!challengeId || !nonce || !loginToken) return genericFailure();

    const state = verifyIdentifyFaceState(loginToken);
    if (!state || state.challengeId !== challengeId || state.expiresAt <= Date.now() || state.nonceHash !== hashFaceNonce(nonce)) {
      return genericFailure();
    }

    const challenge = await prisma.authChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, tipo: true, challenge: true, preAuthTokenHash: true, ipHash: true, expiraEm: true, usadoEm: true },
    });
    const now = new Date();
    if (
      !challenge ||
      challenge.tipo !== "LOGIN_FACE_IDENTIFY" ||
      challenge.usadoEm ||
      challenge.expiraEm <= now ||
      challenge.challenge !== state.challenge ||
      challenge.preAuthTokenHash !== hashSecret(loginToken) ||
      challenge.ipHash !== ipHash
    ) return genericFailure();

    const consumed = await prisma.authChallenge.updateMany({
      where: { id: challenge.id, tipo: "LOGIN_FACE_IDENTIFY", usadoEm: null, expiraEm: { gt: now }, preAuthTokenHash: hashSecret(loginToken) },
      data: { usadoEm: now },
    });
    if (consumed.count !== 1) return genericFailure();
    if (!candidate) return genericFailure();

    const templates = await prisma.faceTemplate.findMany({
      where: {
        revogadoEm: null,
        funcionario: { ativo: true, papel: PapelFuncionario.ADMIN },
      },
      select: {
        funcionarioId: true,
        embeddingEncrypted: true,
        iv: true,
        tag: true,
        modelVersion: true,
        funcionario: { select: { papel: true, cracha: true } },
      },
    });
    if (templates.length === 0) return genericFailure();

    const templatesByEmployee = new Map<number, string[]>();
    for (const template of templates) {
      const versions = templatesByEmployee.get(template.funcionarioId) ?? [];
      versions.push(template.modelVersion);
      templatesByEmployee.set(template.funcionarioId, versions);
    }
    if ([...templatesByEmployee.values()].some((versions) => !areFaceTemplateVersionsCompatible(versions))) {
      console.error("[face] Identificação facial negada: versões incompatíveis de template.");
      return unavailable();
    }

    const templateCandidates: Array<{ funcionarioId: number; cracha: string; distance: number }> = [];
    try {
      for (const template of templates) {
        const embedding = decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag);
        templateCandidates.push({
          funcionarioId: template.funcionarioId,
          cracha: template.funcionario.cracha,
          distance: faceEmbeddingDistance(candidate, embedding),
        });
      }
    } catch (error) {
      console.error("[face] Não foi possível decifrar o template facial.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return unavailable();
    }
    const rankedCandidates = bestFaceMatchPerEmployee(templateCandidates);
    if (rankedCandidates.length === 0) return genericFailure();

    const best = rankedCandidates[0];
    const second = rankedCandidates[1];
    const threshold = getFaceMatchThreshold();
    const minMargin = getFaceIdentifyMinMargin();
    const accepted = isFaceEmbeddingMatch(best.distance, threshold)
      && (!second || best.distance - second.distance > minMargin);

    const retryAfter = await getLoginBlockRetryAfter(best.cracha, ipHash);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (!accepted) {
      await recordLoginFailure(best.cracha, ipHash);
      await prisma.securityAuditEvent.create({
        data: {
          acao: "FACE_IDENTIFY_LOGIN",
          resultado: "failure",
          ipHash,
          detalhe: second && best.distance - second.distance <= minMargin ? "ambiguous_match" : "no_match",
        },
      });
      return genericFailure();
    }

    const funcionario = await prisma.funcionario.findFirst({
      where: { id: best.funcionarioId, ativo: true, papel: PapelFuncionario.ADMIN },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        cracha: true,
        papel: true,
        mustChangePassword: true,
      },
    });
    if (!funcionario) {
      await prisma.securityAuditEvent.create({ data: { acao: "FACE_IDENTIFY_LOGIN", resultado: "failure", ipHash, detalhe: "employee_missing" } });
      return genericFailure();
    }

    const totp = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: funcionario.id } });
    if (totp?.enabledAt) {
      const preAuthToken = createSecret();
      await prisma.authChallenge.create({
        data: {
          tipo: "ADMIN_TOTP",
          preAuthTokenHash: hashSecret(preAuthToken),
          funcionarioId: funcionario.id,
          ipHash,
          expiraEm: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      await prisma.securityAuditEvent.create({
        data: { acao: "FACE_IDENTIFY_LOGIN", resultado: "success", funcionarioId: funcionario.id, ipHash, detalhe: "admin_totp_required" },
      });
      return NextResponse.json({ step: "totp", preAuthToken }, { status: 202 });
    }

    const session = await createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel));
    if (!session) {
      await prisma.securityAuditEvent.create({ data: { acao: "FACE_IDENTIFY_LOGIN", resultado: "failure", funcionarioId: funcionario.id, ipHash, detalhe: "session_create_failed" } });
      return genericFailure();
    }
    await prisma.securityAuditEvent.create({
      data: { acao: "FACE_IDENTIFY_LOGIN", resultado: "success", funcionarioId: funcionario.id, ipHash },
    });
    await clearBadgeLoginFailures(funcionario.cracha);
    return session;
  } catch (error) {
    if (isLoginAttemptStorageUnavailable(error)) return loginAttemptStorageUnavailableResponse();
    if (error instanceof FaceRecognitionUnavailableError) {
      console.error("[face] Login facial indisponível por configuração local do modelo, chave ou limiar.");
      return unavailable();
    }
    if (error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022")) {
      console.error("[face] Login facial indisponível: aplique a migration de templates faciais.", { code: error.code });
      return unavailable();
    }
    const errorId = randomUUID();
    console.error("Falha na identificação facial 1-para-N", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível identificar com segurança. Use o crachá.", errorId }, { status: 500 });
  }
}
