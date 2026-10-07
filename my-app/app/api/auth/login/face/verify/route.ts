import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { areFaceTemplateVersionsCompatible, decryptEmbedding, FaceRecognitionUnavailableError, faceAttemptLimit, faceEmbeddingDistance, getFaceMatchThreshold, hashFaceNonce, isFaceEmbeddingMatch, validateFaceEmbedding } from "@/lib/face";
import { isFaceLoginEnabled } from "@/lib/facial/config";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  loginAttemptStorageUnavailableResponse,
  recordLoginFailure,
} from "@/lib/login-attempts";
import { createLoginSessionSuccessResponse, getLoginAccessArea, verifyLoginFaceState } from "@/lib/login-flow";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { clearFactorFailures, isFactorBlocked, recordFactorFailure } from "@/lib/security-attempts";
import { hashSecret, trustedDeviceCookieName } from "@/lib/webauthn";

const genericFailure = () => NextResponse.json({ error: "Não foi possível verificar o acesso. Tente novamente ou procure o administrador." }, { status: 401 });
const faceServiceUnavailable = () => NextResponse.json(
  { error: "O reconhecimento facial está temporariamente indisponível. Tente novamente mais tarde ou procure o administrador." },
  { status: 503 },
);

async function verifyAlmoxarifeFace(challengeId: string, nonce: string, candidate: number[] | null, ipHash: string) {
  const challenge = await prisma.livenessChallenge.findUnique({
    where: { id: challengeId },
    include: { funcionario: true, trustedDevice: true },
  });
  const now = new Date();
  if (
    !challenge ||
    challenge.usadoEm ||
    challenge.expiraEm <= now ||
    challenge.nonceHash !== hashFaceNonce(nonce) ||
    !challenge.trustedDevice ||
    challenge.trustedDevice.revogadoEm ||
    !challenge.funcionario.ativo ||
    challenge.funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) return genericFailure();
  const retryAfter = await getLoginBlockRetryAfter(challenge.funcionario.cracha, ipHash);
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const deviceToken = (await cookies()).get(trustedDeviceCookieName)?.value;
  if (!deviceToken || hashSecret(deviceToken) !== challenge.trustedDevice.tokenHash) return genericFailure();
  const factorKey = `${challenge.funcionarioId}:${challenge.trustedDeviceId}:${ipHash}`;
  if (isFactorBlocked(factorKey)) {
    return NextResponse.json(
      { error: "Verificação temporariamente bloqueada. Procure o administrador." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const templates = await prisma.faceTemplate.findMany({
    where: { funcionarioId: challenge.funcionarioId, revogadoEm: null },
    select: { embeddingEncrypted: true, iv: true, tag: true, modelVersion: true },
  });
  let matched = false;
  let embeddings: number[][];
  try {
    if (!areFaceTemplateVersionsCompatible(templates.map((template) => template.modelVersion))) {
      console.error("[face] Login facial negado: versões incompatíveis de template.");
      return faceServiceUnavailable();
    }
    embeddings = templates.map((template) => decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag));
    const threshold = getFaceMatchThreshold();
    matched = candidate !== null && embeddings.some((template) =>
      isFaceEmbeddingMatch(faceEmbeddingDistance(candidate, template), threshold),
    );
  } catch (error) {
    if (error instanceof FaceRecognitionUnavailableError) return faceServiceUnavailable();
    console.error("[face] Não foi possível decifrar o template facial.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return faceServiceUnavailable();
  }
  if (!matched) {
    const failureCount = recordFactorFailure(factorKey);
    await recordLoginFailure(challenge.funcionario.cracha, ipHash);
    await prisma.$transaction(async (transaction) => {
      await transaction.livenessChallenge.updateMany({ where: { id: challenge.id, usadoEm: null }, data: { usadoEm: now } });
      await transaction.faceAuthAttempt.create({
        data: {
          funcionarioId: challenge.funcionarioId,
          trustedDeviceId: challenge.trustedDeviceId,
          resultado: failureCount >= faceAttemptLimit ? "blocked" : "failure",
          ipHash,
        },
      });
      await transaction.securityAuditEvent.create({
        data: {
          acao: "FACE_LOGIN",
          resultado: failureCount >= faceAttemptLimit ? "blocked" : "failure",
          funcionarioId: challenge.funcionarioId,
          trustedDeviceId: challenge.trustedDeviceId,
          ipHash,
        },
      });
    });
    return failureCount >= faceAttemptLimit
      ? NextResponse.json({ error: "Verificação temporariamente bloqueada. Procure o administrador." }, { status: 429 })
      : genericFailure();
  }

  const completedAt = new Date();
  const sessionToken = randomBytes(32).toString("hex");
  const accepted = await prisma.$transaction(async (transaction) => {
    const currentEmployee = await transaction.funcionario.findFirst({
      where: { id: challenge.funcionarioId, ativo: true, papel: PapelFuncionario.ALMOXARIFE },
      select: {
        id: true, nome: true, email: true, cargo: true, cracha: true, papel: true, mustChangePassword: true,
      },
    });
    if (!currentEmployee) return false;
    const consumed = await transaction.livenessChallenge.updateMany({
      where: { id: challenge.id, usadoEm: null, expiraEm: { gt: completedAt }, nonceHash: hashFaceNonce(nonce) },
      data: { usadoEm: completedAt },
    });
    if (consumed.count !== 1) return false;
    await transaction.sessao.create({
      data: {
        token: sessionToken,
        funcionarioId: challenge.funcionarioId,
        accessArea: "almoxarifado",
        trustedDeviceId: challenge.trustedDeviceId,
        expiresAt: new Date(completedAt.getTime() + 8 * 60 * 60 * 1000),
      },
    });
    await transaction.trustedDevice.update({
      where: { id: challenge.trustedDeviceId, revogadoEm: null },
      data: { ultimoAcessoEm: completedAt },
    });
    await transaction.faceAuthAttempt.create({
      data: { funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, resultado: "success", ipHash },
    });
    await transaction.securityAuditEvent.create({
      data: { acao: "FACE_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash },
    });
    return currentEmployee;
  });
  if (!accepted || challenge.expiraEm <= completedAt) return genericFailure();

  clearFactorFailures(factorKey);
  await clearBadgeLoginFailures(challenge.funcionario.cracha);
  return createLoginSessionSuccessResponse(accepted, sessionToken);
}

export async function POST(request: Request) {
  try {
    if (!isFaceLoginEnabled()) return genericFailure();
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 32 * 1024) return genericFailure();
    const ipHash = getLoginClientIpHash(request);
    if (isRateLimited(`face-verify:${ipHash}`, 9, 15 * 60 * 1000)) {
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
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const loginToken = typeof body.loginToken === "string" ? body.loginToken : "";
    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    let candidate: number[] | null = null;
    try {
      if (body.challengeCompleted === true) candidate = validateFaceEmbedding(body.embedding);
    } catch {
      candidate = null;
    }
    if (!challengeId || !nonce) return genericFailure();
    if (!loginToken) return verifyAlmoxarifeFace(challengeId, nonce, candidate, ipHash);


    const state = verifyLoginFaceState(loginToken);
    if (!state || state.challengeId !== challengeId || state.expiresAt <= Date.now() || state.nonceHash !== hashFaceNonce(nonce)) return genericFailure();
    const challenge = await prisma.authChallenge.findUnique({
      where: { id: challengeId },
      include: { funcionario: true },
    });
    const now = new Date();
    if (
      !challenge ||
      challenge.tipo !== "LOGIN_FACE" ||
      challenge.usadoEm ||
      challenge.expiraEm <= now ||
      challenge.funcionarioId !== state.funcionarioId ||
      challenge.preAuthTokenHash !== hashSecret(loginToken) ||
      challenge.challenge !== state.challenge ||
      challenge.ipHash !== ipHash ||
      !challenge.funcionario.ativo ||
      challenge.funcionario.papel !== PapelFuncionario.ADMIN
    ) return genericFailure();

    const retryAfter = await getLoginBlockRetryAfter(challenge.funcionario.cracha, ipHash);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const factorKey = `login-face:${challenge.funcionarioId}:${ipHash}`;
    if (isFactorBlocked(factorKey)) {
      return NextResponse.json(
        { error: "Verificação temporariamente bloqueada. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const templates = await prisma.faceTemplate.findMany({
      where: { funcionarioId: challenge.funcionarioId, revogadoEm: null },
      select: { embeddingEncrypted: true, iv: true, tag: true, modelVersion: true },
    });
    let matched = false;
    if (templates.length > 0) {
      let embeddings: number[][];
      try {
        if (!areFaceTemplateVersionsCompatible(templates.map((template) => template.modelVersion))) {
          console.error("[face] Login facial negado: versão do template incompatível.");
          return faceServiceUnavailable();
        }
        embeddings = templates.map((template) => decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag));
        const threshold = getFaceMatchThreshold();
        matched = candidate !== null && embeddings.some((template) =>
          isFaceEmbeddingMatch(faceEmbeddingDistance(candidate, template), threshold),
        );
      } catch (error) {
        if (error instanceof FaceRecognitionUnavailableError) return faceServiceUnavailable();
        console.error("[face] Não foi possível decifrar o template facial.", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return faceServiceUnavailable();
      }
    }

    if (!matched) {
      const failedAt = new Date();
      const consumed = await prisma.authChallenge.updateMany({
        where: { id: challenge.id, tipo: "LOGIN_FACE", usadoEm: null, expiraEm: { gt: failedAt }, preAuthTokenHash: hashSecret(loginToken) },
        data: { usadoEm: failedAt },
      });
      if (consumed.count !== 1) return genericFailure();
      const failureCount = recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      await prisma.securityAuditEvent.create({
        data: { acao: "FACE_LOGIN", resultado: failureCount >= faceAttemptLimit ? "blocked" : "failure", funcionarioId: challenge.funcionarioId, ipHash },
      });
      return failureCount >= faceAttemptLimit
        ? NextResponse.json({ error: "Verificação temporariamente bloqueada. Tente novamente mais tarde." }, { status: 429 })
        : genericFailure();
    }

    const completedAt = new Date();
    if (state.expiresAt <= completedAt.getTime()) return genericFailure();
    const sessionToken = randomBytes(32).toString("hex");
    const accepted = await prisma.$transaction(async (transaction) => {
      const currentEmployee = await transaction.funcionario.findFirst({
        where: { id: challenge.funcionarioId, ativo: true, papel: challenge.funcionario.papel },
        select: {
          id: true, nome: true, email: true, cargo: true, cracha: true, papel: true, mustChangePassword: true,
        },
      });
      if (!currentEmployee) return null;
      const consumed = await transaction.authChallenge.updateMany({
        where: {
          id: challenge.id,
          tipo: "LOGIN_FACE",
          usadoEm: null,
          expiraEm: { gt: completedAt },
          preAuthTokenHash: hashSecret(loginToken),
        },
        data: { usadoEm: completedAt },
      });
      if (consumed.count !== 1) return null;
      await transaction.sessao.create({
        data: {
          token: sessionToken,
          funcionarioId: challenge.funcionarioId,
          accessArea: getLoginAccessArea(currentEmployee.papel),
          expiresAt: new Date(completedAt.getTime() + 8 * 60 * 60 * 1000),
        },
      });
      await transaction.securityAuditEvent.create({
        data: { acao: "FACE_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, ipHash },
      });
      return currentEmployee;
    });
    if (!accepted) return genericFailure();

    clearFactorFailures(factorKey);
    await clearBadgeLoginFailures(challenge.funcionario.cracha);
    return createLoginSessionSuccessResponse(accepted, sessionToken);
  } catch (error) {
    if (isLoginAttemptStorageUnavailable(error)) return loginAttemptStorageUnavailableResponse();
    if (error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022")) {
      console.error("[face] Login facial indisponível: aplique a migration de templates faciais.", { code: error.code });
      return faceServiceUnavailable();
    }
    const errorId = randomUUID();
    console.error("Falha na verificação facial do login", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível verificar o acesso.", errorId }, { status: 500 });
  }
}
