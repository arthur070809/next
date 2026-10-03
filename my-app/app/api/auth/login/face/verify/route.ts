import { papelParaRole } from "@/lib/auth";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import { decryptEmbedding, faceAttemptLimit, hashFaceNonce, verifyFaceCapture } from "@/lib/face";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { clearFactorFailures, isFactorBlocked, recordFactorFailure } from "@/lib/security-attempts";
import { getClientIpHash, hashSecret, trustedDeviceCookieName } from "@/lib/webauthn";

const genericFailure = () => NextResponse.json({ error: "Não foi possível verificar o acesso. Tente novamente ou procure o administrador." }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024 * 1024) return genericFailure();
    const ipHash = getClientIpHash(request);
    if (isRateLimited(`face-verify:${ipHash}`, 9, 15 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    const capture = body.capture;
    if (!challengeId || !nonce || typeof capture !== "string") return genericFailure();

    const challenge = await prisma.livenessChallenge.findUnique({
      where: { id: challengeId },
      include: { funcionario: true, trustedDevice: true },
    });
    const now = new Date();
    if (!challenge || challenge.usadoEm || challenge.expiraEm <= now || challenge.nonceHash !== hashFaceNonce(nonce) || !challenge.trustedDevice || challenge.trustedDevice.revogadoEm || !challenge.funcionario.ativo || challenge.funcionario.papel !== "ALMOXARIFE") return genericFailure();

    const deviceToken = (await cookies()).get(trustedDeviceCookieName)?.value;
    if (!deviceToken || hashSecret(deviceToken) !== challenge.trustedDevice.tokenHash) return genericFailure();
    const factorKey = `${challenge.funcionarioId}:${challenge.trustedDeviceId}:${ipHash}`;
    if (isFactorBlocked(factorKey)) return NextResponse.json({ error: "Verificação temporariamente bloqueada. Procure o administrador." }, { status: 429 });

    const templates = await prisma.faceTemplate.findMany({
      where: { funcionarioId: challenge.funcionarioId, revogadoEm: null },
      select: { embeddingEncrypted: true, iv: true, tag: true },
    });
    if (templates.length === 0) return genericFailure();

    let matched = false;
    try {
      matched = await verifyFaceCapture(capture, { tipo: challenge.tipo, nonce }, templates.map((template) => decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag)));
    } catch {
      matched = false;
    }

    if (!matched) {
      const failureCount = recordFactorFailure(factorKey);
      await prisma.$transaction(async (transaction) => {
        await transaction.livenessChallenge.updateMany({ where: { id: challenge.id, usadoEm: null }, data: { usadoEm: now } });
        await transaction.faceAuthAttempt.create({ data: { funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, resultado: failureCount >= faceAttemptLimit ? "blocked" : "failure", ipHash } });
        await transaction.securityAuditEvent.create({ data: { acao: "FACE_LOGIN", resultado: failureCount >= faceAttemptLimit ? "blocked" : "failure", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash } });
      });
      return failureCount >= faceAttemptLimit
        ? NextResponse.json({ error: "Verificação temporariamente bloqueada. Procure o administrador." }, { status: 429 })
        : genericFailure();
    }

    const sessionToken = randomBytes(32).toString("hex");
    const accepted = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.livenessChallenge.updateMany({ where: { id: challenge.id, usadoEm: null, expiraEm: { gt: now }, nonceHash: hashFaceNonce(nonce) }, data: { usadoEm: now } });
      if (consumed.count !== 1) return false;
      await transaction.sessao.create({ data: { token: sessionToken, funcionarioId: challenge.funcionarioId, accessArea: "almoxarifado", trustedDeviceId: challenge.trustedDeviceId, expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000) } });
      await transaction.trustedDevice.update({ where: { id: challenge.trustedDeviceId, revogadoEm: null }, data: { ultimoAcessoEm: now } });
      await transaction.faceAuthAttempt.create({ data: { funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, resultado: "success", ipHash } });
      await transaction.securityAuditEvent.create({ data: { acao: "FACE_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!accepted) return genericFailure();
    clearFactorFailures(factorKey);

    const response = NextResponse.json({ message: "Login realizado com sucesso.", funcionario: {
      id: challenge.funcionario.id, nome: challenge.funcionario.nome, email: challenge.funcionario.email, cargo: challenge.funcionario.cargo, cracha: challenge.funcionario.cracha, role: papelParaRole(challenge.funcionario.papel), mustChangePassword: challenge.funcionario.mustChangePassword,
    } });
    response.cookies.set(sessionCookieName, sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha na verificação facial", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível verificar o acesso.", errorId }, { status: 500 });
  }
}