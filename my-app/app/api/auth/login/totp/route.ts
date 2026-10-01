import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { decryptSecuritySecret } from "@/lib/security-crypto";
import { clearFactorFailures, isFactorBlocked, recordFactorFailure } from "@/lib/security-attempts";
import { verifyTotp } from "@/lib/totp";
import { getClientIpHash, hashSecret } from "@/lib/webauthn";

const failed = () => NextResponse.json({ error: "Não foi possível verificar o código. Tente novamente." }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const ipHash = getClientIpHash(request);
    if (isRateLimited(`admin-totp:${ipHash}`, 10, 15 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    const body = await request.json().catch(() => ({}));
    const preAuthToken = typeof body.preAuthToken === "string" ? body.preAuthToken : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!preAuthToken || !/^\d{6}$/.test(code)) return failed();

    const challenge = await prisma.authChallenge.findUnique({
      where: { preAuthTokenHash: hashSecret(preAuthToken) },
      include: { funcionario: true },
    });
    const now = new Date();
    if (!challenge || challenge.tipo !== "ADMIN_TOTP" || challenge.usadoEm || challenge.expiraEm <= now || challenge.ipHash !== ipHash || !challenge.funcionario.ativo || challenge.funcionario.role !== "admin") return failed();
    const factorKey = `admin:${challenge.funcionarioId}:${challenge.ipHash}`;
    if (isFactorBlocked(factorKey)) return NextResponse.json({ error: "Verificação temporariamente bloqueada." }, { status: 429 });

    const totp = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: challenge.funcionarioId } });
    if (!totp?.enabledAt) return failed();
    const secret = decryptSecuritySecret(totp.secretCiphertext, totp.secretIv, totp.secretTag);
    const verifiedStep = verifyTotp(secret, code);
    if (verifiedStep === null || BigInt(verifiedStep) <= totp.lastVerifiedStep) {
      recordFactorFailure(factorKey);
      await prisma.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_LOGIN", resultado: "failure", funcionarioId: challenge.funcionarioId, ipHash } });
      return failed();
    }

    const sessionToken = randomBytes(32).toString("hex");
    const completedAt = new Date();
    const accepted = await prisma.$transaction(async (transaction) => {
      const usedChallenge = await transaction.authChallenge.updateMany({ where: { id: challenge.id, usadoEm: null, expiraEm: { gt: completedAt } }, data: { usadoEm: completedAt } });
      if (usedChallenge.count !== 1) return false;
      const usedStep = await transaction.adminTotpCredential.updateMany({ where: { id: totp.id, enabledAt: { not: null }, lastVerifiedStep: totp.lastVerifiedStep }, data: { lastVerifiedStep: BigInt(verifiedStep) } });
      if (usedStep.count !== 1) return false;
      await transaction.sessao.create({ data: { token: sessionToken, funcionarioId: challenge.funcionarioId, accessArea: "admin", expiresAt: new Date(completedAt.getTime() + 8 * 60 * 60 * 1000) } });
      await transaction.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, ipHash } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!accepted) { recordFactorFailure(factorKey); return failed(); }
    clearFactorFailures(factorKey);

    const funcionario = challenge.funcionario;
    const response = NextResponse.json({
      message: "Login realizado com sucesso.",
      funcionario: { id: funcionario.id, nome: funcionario.nome, email: funcionario.email, cargo: funcionario.cargo, cracha: funcionario.cracha, role: funcionario.role, mustChangePassword: funcionario.mustChangePassword },
    });
    response.cookies.set(sessionCookieName, sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao validar TOTP do admin", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível verificar o código.", errorId }, { status: 500 });
  }
}