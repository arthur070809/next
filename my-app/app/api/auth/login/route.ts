import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { clearBadgeLoginFailures, isLoginTemporarilyBlocked, recordLoginFailure } from "@/lib/login-attempts";
import { createLoginFaceChallenge, createLoginSessionResponse, getLoginAccessArea, loginRequiresFace } from "@/lib/login-flow";
import { PapelFuncionario } from "@/generated/prisma/client";
import { createSecret, getClientIpHash, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName, webauthnChallengeTtlMs } from "@/lib/webauthn";

const invalidCode = () => NextResponse.json({ error: "Código inválido." }, { status: 401 });
const minInvalidResponseMs = 200;

async function invalidCodeResponse(startedAt: number, badge: string, ipHash: string) {
  await recordLoginFailure(badge, ipHash);
  const remaining = minInvalidResponseMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return invalidCode();
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 8192) return invalidCodeResponse(startedAt, "", getClientIpHash(request));

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return invalidCodeResponse(startedAt, "", getClientIpHash(request));
    }
    const suppliedCode = typeof body.codigoCracha === "string" ? body.codigoCracha : "";
    const badge = suppliedCode.toUpperCase().slice(0, 20);
    const validCode = suppliedCode === suppliedCode.trim() && /^[A-Z0-9-]{1,20}$/.test(badge);
    const ipHash = getClientIpHash(request);

    if (await isLoginTemporarilyBlocked(badge, ipHash)) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em 15 minutos." }, { status: 429 });
    }

    const lookupCode = validCode ? badge : "__INVALID_BADGE__";
    const funcionario = await prisma.funcionario.findFirst({ where: { cracha: lookupCode } });
    if (
      !validCode ||
      !funcionario ||
      !funcionario.ativo ||
      (funcionario.papel !== PapelFuncionario.ADMIN &&
        funcionario.papel !== PapelFuncionario.ALMOXARIFE &&
        funcionario.papel !== PapelFuncionario.OPERADOR)
    ) {
      return invalidCodeResponse(startedAt, badge, ipHash);
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
        return NextResponse.json({ step: "totp", preAuthToken }, { status: 202 });
      }
    }

    if (loginRequiresFace(funcionario.papel)) {
      return NextResponse.json(await createLoginFaceChallenge(funcionario.id, ipHash), { status: 202 });
    }

    if (funcionario.papel === PapelFuncionario.ALMOXARIFE) {
      const cookieStore = await cookies();
      const deviceToken = cookieStore.get(trustedDeviceCookieName)?.value;
      if (!deviceToken) return invalidCodeResponse(startedAt, badge, ipHash);

      const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashSecret(deviceToken) } });
      if (!device || device.revogadoEm) return invalidCodeResponse(startedAt, badge, ipHash);
      const employeeDevice = await prisma.webAuthnCredential.findMany({
        where: { funcionarioId: funcionario.id, trustedDeviceId: device.id, revogadoEm: null },
        select: { credentialId: true, transports: true },
      });

      const emergencyGrant = await prisma.emergencyAccessGrant.findFirst({
        where: { funcionarioId: funcionario.id, trustedDeviceId: device.id, expiraEm: { gt: new Date() }, usadoEm: null },
        orderBy: { criadoEm: "desc" },
      });
      if (emergencyGrant) {
        const consumed = await prisma.$transaction(async (transaction) => {
          const result = await transaction.emergencyAccessGrant.updateMany({
            where: { id: emergencyGrant.id, usadoEm: null, expiraEm: { gt: new Date() } },
            data: { usadoEm: new Date() },
          });
          if (result.count !== 1) return false;
          await transaction.securityAuditEvent.create({
            data: { acao: "EMERGENCY_ACCESS_USED", resultado: "emergency", funcionarioId: funcionario.id, trustedDeviceId: device.id, ipHash },
          });
          await transaction.trustedDevice.update({ where: { id: device.id }, data: { ultimoAcessoEm: new Date() } });
          return true;
        });
        if (consumed) {
          await clearBadgeLoginFailures(badge, ipHash);
          return createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel), device.id);
        }
      }

      if (employeeDevice.length === 0) return invalidCodeResponse(startedAt, badge, ipHash);
      const relyingParty = getWebAuthnRelyingParty(request.url);
      const options = await generateAuthenticationOptions({
        rpID: relyingParty.rpID,
        allowCredentials: employeeDevice.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports ? JSON.parse(credential.transports) : undefined,
        })),
        userVerification: "required",
        timeout: webauthnChallengeTtlMs,
      });
      const challenge = await prisma.authChallenge.create({
        data: {
          tipo: "USER_WEBAUTHN",
          challenge: options.challenge,
          funcionarioId: funcionario.id,
          trustedDeviceId: device.id,
          ipHash,
          expiraEm: new Date(Date.now() + webauthnChallengeTtlMs),
        },
        select: { id: true },
      });
      await prisma.securityAuditEvent.create({
        data: { acao: "WEBAUTHN_LOGIN_CHALLENGE", resultado: "success", funcionarioId: funcionario.id, trustedDeviceId: device.id, ipHash },
      });
      return NextResponse.json({ step: "webauthn", challengeId: challenge.id, options }, { status: 202 });
    }

    await clearBadgeLoginFailures(badge, ipHash);
    return createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel));
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha no login", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível concluir o login.", errorId }, { status: 500 });
  }
}
