import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  loginAttemptStorageUnavailableResponse,
  recordLoginFailure,
} from "@/lib/login-attempts";
import { createLoginFaceChallenge, createLoginSessionResponse, getLoginAccessArea, loginRequiresFace } from "@/lib/login-flow";
import { decryptSecuritySecret } from "@/lib/security-crypto";
import { clearFactorFailures, isFactorBlocked, recordFactorFailure } from "@/lib/security-attempts";
import { verifyTotp } from "@/lib/totp";
import { hashSecret } from "@/lib/webauthn";
import { PapelFuncionario } from "@/generated/prisma/client";

const failed = () => NextResponse.json({ error: "Não foi possível verificar o código. Tente novamente." }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const ipHash = getLoginClientIpHash(request);
    if (isRateLimited(`admin-totp:${ipHash}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const preAuthToken = typeof body.preAuthToken === "string" ? body.preAuthToken : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!preAuthToken || !/^\d{6}$/.test(code)) return failed();

    const challenge = await prisma.authChallenge.findUnique({
      where: { preAuthTokenHash: hashSecret(preAuthToken) },
      include: { funcionario: true },
    });
    const now = new Date();
    if (!challenge || challenge.tipo !== "ADMIN_TOTP" || challenge.usadoEm || challenge.expiraEm <= now || challenge.ipHash !== ipHash || !challenge.funcionario.ativo || challenge.funcionario.papel !== PapelFuncionario.ADMIN) return failed();
    const retryAfter = await getLoginBlockRetryAfter(challenge.funcionario.cracha, ipHash);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const factorKey = `admin:${challenge.funcionarioId}:${challenge.ipHash}`;
    if (isFactorBlocked(factorKey)) {
      return NextResponse.json(
        { error: "Verificação temporariamente bloqueada." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const totp = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: challenge.funcionarioId } });
    if (!totp?.enabledAt) return failed();
    const secret = decryptSecuritySecret(totp.secretCiphertext, totp.secretIv, totp.secretTag);
    const verifiedStep = verifyTotp(secret, code);
    if (verifiedStep === null || BigInt(verifiedStep) <= totp.lastVerifiedStep) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      await prisma.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_LOGIN", resultado: "failure", funcionarioId: challenge.funcionarioId, ipHash } });
      return failed();
    }

    const completedAt = new Date();
    const accepted = await prisma.$transaction(async (transaction) => {
      const currentEmployee = await transaction.funcionario.findFirst({
        where: { id: challenge.funcionarioId, ativo: true, papel: PapelFuncionario.ADMIN },
        select: { id: true },
      });
      if (!currentEmployee) return false;
      const usedChallenge = await transaction.authChallenge.updateMany({
        where: { id: challenge.id, usadoEm: null, expiraEm: { gt: completedAt } },
        data: { usadoEm: completedAt },
      });
      if (usedChallenge.count !== 1) return false;
      const usedStep = await transaction.adminTotpCredential.updateMany({
        where: { id: totp.id, enabledAt: { not: null }, lastVerifiedStep: totp.lastVerifiedStep },
        data: { lastVerifiedStep: BigInt(verifiedStep) },
      });
      if (usedStep.count !== 1) return false;
      await transaction.securityAuditEvent.create({
        data: { acao: "ADMIN_TOTP_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, ipHash },
      });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!accepted) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      return failed();
    }
    clearFactorFailures(factorKey);

    if (loginRequiresFace(challenge.funcionario.papel)) {
      const faceTemplateCount = await prisma.faceTemplate.count({
        where: { funcionarioId: challenge.funcionarioId, revogadoEm: null },
      });
      if (faceTemplateCount > 0) {
        return NextResponse.json(await createLoginFaceChallenge(challenge.funcionarioId, ipHash), { status: 202 });
      }
    }
    await clearBadgeLoginFailures(challenge.funcionario.cracha);
    const session = await createLoginSessionResponse(challenge.funcionario, getLoginAccessArea(challenge.funcionario.papel));
    return session ?? failed();
  } catch (error) {
    if (isLoginAttemptStorageUnavailable(error)) return loginAttemptStorageUnavailableResponse();
    const errorId = randomUUID();
    console.error("Falha ao validar TOTP do admin", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível verificar o código.", errorId }, { status: 500 });
  }
}
