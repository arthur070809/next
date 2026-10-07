import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { areFaceTemplateVersionsCompatible, bestFaceMatchPerEmployee, decryptEmbedding, faceEmbeddingDistance, FaceServiceUnavailableError, getFaceIdentifyMinMargin, getFaceMatchThreshold, hashFaceNonce, isFaceEmbeddingMatch, validateFaceCapture } from "@/lib/face";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  loginAttemptStorageUnavailableResponse,
  recordLoginFailure,
} from "@/lib/login-attempts";
import { createLoginSessionResponse, getLoginAccessArea, verifyIdentifyFaceState } from "@/lib/login-flow";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { createSecret, hashSecret } from "@/lib/webauthn";

const genericFailure = () => NextResponse.json({ error: "Não foi possível identificar com segurança. Use o crachá." }, { status: 401 });
const diagnosticsEnabled = () => process.env.FACE_DIAGNOSTICS_ENABLED === "true";

async function extractCaptureEmbedding(capture: string): Promise<number[] | null> {
  const baseUrl = process.env.FACE_SERVICE_URL?.trim();
  const token = process.env.FACE_SERVICE_TOKEN?.trim();
  if (!baseUrl || !token) throw new FaceServiceUnavailableError();
  validateFaceCapture(capture);
  const endpoints = [
    `${baseUrl.replace(/\/$/, "")}/v1/embedding`,
    `${baseUrl.replace(/\/$/, "")}/v1/embed`,
    `${baseUrl.replace(/\/$/, "")}/v1/encode`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ capture }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as Record<string, unknown>;
      const nested = payload.result && typeof payload.result === "object" ? payload.result as Record<string, unknown> : undefined;
      const embeddingCandidate = Array.isArray(payload.embedding)
        ? payload.embedding
        : Array.isArray(payload.embeddings)
          ? (payload.embeddings as unknown[])[0]
          : Array.isArray(nested?.embedding)
            ? nested.embedding
            : null;
      if (Array.isArray(embeddingCandidate) && embeddingCandidate.length >= 32 && embeddingCandidate.every((value): value is number => typeof value === "number" && Number.isFinite(value))) {
        return embeddingCandidate as number[];
      }
    } catch {
      // Some biometric providers expose slightly different extraction endpoints; fall through to the next option.
    }
  }
  throw new FaceServiceUnavailableError();
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 3 * 1024 * 1024)) {
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
    const capture = typeof body.capture === "string" ? body.capture : "";
    if (!challengeId || !nonce || !capture || !loginToken) return genericFailure();

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
    ) {
      return genericFailure();
    }

    let captureEmbedding: number[] | null;
    try {
      captureEmbedding = await extractCaptureEmbedding(capture);
    } catch (error) {
      if (error instanceof FaceServiceUnavailableError) {
        console.error("[face] Identificação facial indisponível por configuração ou serviço.");
        return NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });
      }
      return genericFailure();
    }
    if (!captureEmbedding) return genericFailure();

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
      return NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });
    }
    const templateCandidates: Array<{ funcionarioId: number; cracha: string; distance: number }> = [];
    try {
      for (const template of templates) {
        const embedding = decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag);
        templateCandidates.push({
          funcionarioId: template.funcionarioId,
          cracha: template.funcionario.cracha,
          distance: faceEmbeddingDistance(captureEmbedding, embedding),
        });
      }
    } catch (error) {
      console.error("[face] Não foi possível decifrar o template facial.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });
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
      if (diagnosticsEnabled()) {
        console.info("[face:diagnostics]", {
          event: "login_rejected",
          distance: best.distance,
          threshold,
          rejectionReason: second && best.distance - second.distance <= minMargin ? "ambiguous_match" : "no_match",
        });
      }
      return genericFailure();
    }
    if (diagnosticsEnabled()) {
      console.info("[face:diagnostics]", {
        event: "login_candidate",
        distance: best.distance,
        threshold,
        rejectionReason: "candidate_accepted",
      });
    }

    const funcionario = await prisma.funcionario.findFirst({
      where: { id: best.funcionarioId, ativo: true },
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

    const consumed = await prisma.authChallenge.updateMany({
      where: {
        id: challenge.id,
        tipo: "LOGIN_FACE_IDENTIFY",
        usadoEm: null,
        expiraEm: { gt: now },
        preAuthTokenHash: hashSecret(loginToken),
      },
      data: { usadoEm: now },
    });
    if (consumed.count !== 1) {
      await recordLoginFailure(funcionario.cracha, ipHash);
      return genericFailure();
    }

    if (funcionario.papel === PapelFuncionario.ADMIN) {
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
    if (error instanceof FaceServiceUnavailableError) {
      console.error("[face] Login facial indisponível por configuração do limiar.");
      return NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });
    }
    if (error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022")) {
      console.error("[face] Login facial indisponível: aplique a migration de templates faciais.", { code: error.code });
      return NextResponse.json({ error: "O reconhecimento facial está temporariamente indisponível." }, { status: 503 });
    }
    const errorId = randomUUID();
    console.error("Falha na identificação facial 1-para-N", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível identificar com segurança. Use o crachá.", errorId }, { status: 500 });
  }
}
