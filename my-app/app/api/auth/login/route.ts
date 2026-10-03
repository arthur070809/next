import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { sessionCookieName, papelParaRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, isLoginBlocked, isRateLimited, isSameOrigin, recordLoginFailure } from "@/lib/security";
import { BADGE_PATTERN } from "@/lib/security";
import { getClientIpHash, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName, webauthnChallengeTtlMs } from "@/lib/webauthn";
import { PapelFuncionario } from "@/generated/prisma/client";

function debugLoginFailure(portal: string, reason: string) {
  if (process.env.NODE_ENV !== "production") console.debug("[auth] login failed", { portal, reason });
}

async function createSessionResponse(
  funcionario: { id: number; papel: PapelFuncionario; nome: string; email: string; cargo: string; cracha: string; mustChangePassword: boolean },
  portal: string,
  trustedDeviceId: string | null,
) {
  const token = randomBytes(32).toString("hex");
  await prisma.sessao.create({
    data: { token, funcionarioId: funcionario.id, accessArea: portal, trustedDeviceId, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
  });
  const response = NextResponse.json({
    message: "Login realizado com sucesso.",
    funcionario: {
      id: funcionario.id, nome: funcionario.nome, email: funcionario.email, cargo: funcionario.cargo,
      cracha: funcionario.cracha, role: papelParaRole(funcionario.papel), papel: funcionario.papel,
      mustChangePassword: funcionario.mustChangePassword,
    },
  });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json();
    const identifier = typeof body?.identificador === "string" ? body.identificador.trim()
      : typeof body?.codigoCracha === "string" ? body.codigoCracha.trim() : "";
    const password = typeof body?.senha === "string" ? body.senha : "";
    const portal = body?.portal === "admin" || body?.portal === "almoxarifado" ? body.portal : "";
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isLoginBlocked(`login:${clientKey}`) || isRateLimited(`login:${clientKey}`, 10, 15 * 60 * 1000)) {
      debugLoginFailure(portal || "unknown", "blocked");
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    }
    if (!portal || !identifier || !password) return NextResponse.json({ error: "E-mail/crachá e senha são obrigatórios." }, { status: 400 });

    const email = identifier.toLowerCase();
    const cracha = identifier.toUpperCase();
    const funcionario = portal === "admin"
      ? await prisma.funcionario.findFirst({ where: { login: email, papel: PapelFuncionario.ADMIN } })
      : BADGE_PATTERN.test(cracha)
        ? await prisma.funcionario.findFirst({ where: { cracha, papel: PapelFuncionario.ALMOXARIFE } })
        : null;

    if (!funcionario || !funcionario.ativo || !(await bcrypt.compare(password, funcionario.senha))) {
      debugLoginFailure(portal, !funcionario ? "not_found_or_wrong_role" : !funcionario.ativo ? "inactive" : "password_mismatch");
      recordLoginFailure(`login:${clientKey}`);
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }
    clearLoginFailures(`login:${clientKey}`);

    if (funcionario.papel === PapelFuncionario.ADMIN) {
      const totp = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: funcionario.id } });
      if (totp?.enabledAt) {
        const preAuthToken = randomBytes(32).toString("base64url");
        await prisma.authChallenge.create({
          data: {
            tipo: "ADMIN_TOTP", preAuthTokenHash: hashSecret(preAuthToken), funcionarioId: funcionario.id,
            ipHash: getClientIpHash(request), expiraEm: new Date(Date.now() + 5 * 60 * 1000),
          }
        });
        return NextResponse.json({ step: "totp", preAuthToken }, { status: 202 });
      }
      return createSessionResponse(funcionario, "admin", null);
    }

    const cookieStore = await cookies();
    const deviceToken = cookieStore.get(trustedDeviceCookieName)?.value;
    const ipHash = getClientIpHash(request);
    if (!deviceToken) {
      await prisma.securityAuditEvent.create({ data: { acao: "DEVICE_LOGIN_DENIED", resultado: "denied", funcionarioId: funcionario.id, ipHash, detalhe: "Aparelho não pareado." } });
      return NextResponse.json({ error: "Não foi possível verificar este aparelho. Procure o administrador." }, { status: 401 });
    }
    const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashSecret(deviceToken) } });
    if (!device || device.revogadoEm) {
      await prisma.securityAuditEvent.create({ data: { acao: "DEVICE_LOGIN_DENIED", resultado: "denied", funcionarioId: funcionario.id, trustedDeviceId: device?.id, ipHash, detalhe: "Aparelho ausente ou revogado." } });
      return NextResponse.json({ error: "Não foi possível verificar este aparelho. Procure o administrador." }, { status: 401 });
    }
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { funcionarioId: funcionario.id, trustedDeviceId: device.id, revogadoEm: null },
      select: { credentialId: true, transports: true },
    });
    const emergencyGrant = await prisma.emergencyAccessGrant.findFirst({
      where: { funcionarioId: funcionario.id, trustedDeviceId: device.id, expiraEm: { gt: new Date() }, usadoEm: null },
      orderBy: { criadoEm: "desc" },
    });
    if (emergencyGrant) {
      const consumed = await prisma.$transaction(async (transaction) => {
        const result = await transaction.emergencyAccessGrant.updateMany({ where: { id: emergencyGrant.id, usadoEm: null, expiraEm: { gt: new Date() } }, data: { usadoEm: new Date() } });
        if (result.count !== 1) return false;
        await transaction.securityAuditEvent.create({ data: { acao: "EMERGENCY_ACCESS_USED", resultado: "emergency", funcionarioId: funcionario.id, trustedDeviceId: device.id, ipHash } });
        await transaction.trustedDevice.update({ where: { id: device.id }, data: { ultimoAcessoEm: new Date() } });
        return true;
      });
      if (consumed) return createSessionResponse(funcionario, "almoxarifado", device.id);
    }

    if (credentials.length === 0) {
      await prisma.securityAuditEvent.create({ data: { acao: "DEVICE_LOGIN_DENIED", resultado: "denied", funcionarioId: funcionario.id, trustedDeviceId: device.id, ipHash, detalhe: "Autenticador não cadastrado." } });
      return NextResponse.json({ error: "Não foi possível verificar este aparelho. Procure o administrador." }, { status: 401 });
    }

    const relyingParty = getWebAuthnRelyingParty(request.url);
    const options = await generateAuthenticationOptions({
      rpID: relyingParty.rpID,
      allowCredentials: credentials.map((credential) => ({ id: credential.credentialId, transports: credential.transports ? JSON.parse(credential.transports) : undefined })),
      userVerification: "required",
      timeout: webauthnChallengeTtlMs,
    });
    const challenge = await prisma.authChallenge.create({
      data: {
        tipo: "USER_WEBAUTHN", challenge: options.challenge, funcionarioId: funcionario.id,
        trustedDeviceId: device.id, ipHash, expiraEm: new Date(Date.now() + webauthnChallengeTtlMs),
      }, select: { id: true }
    });
    await prisma.securityAuditEvent.create({ data: { acao: "WEBAUTHN_LOGIN_CHALLENGE", resultado: "success", funcionarioId: funcionario.id, trustedDeviceId: device.id, ipHash } });
    return NextResponse.json({ step: "webauthn", challengeId: challenge.id, options }, { status: 202 });
  } catch (error) {
    const errorId = randomBytes(8).toString("hex");
    console.error("Falha no login", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível concluir o login.", errorId }, { status: 500 });
  }
}