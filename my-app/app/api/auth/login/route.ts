import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  loginAttemptStorageUnavailableResponse,
  normalizeLoginCode,
  recordLoginFailure,
} from "@/lib/login-attempts";
import { createLoginFaceChallenge, createLoginSessionResponse, getLoginAccessArea, loginRequiresFace } from "@/lib/login-flow";
import { PapelFuncionario } from "@/generated/prisma/client";
import { createSecret, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName, webauthnChallengeTtlMs } from "@/lib/webauthn";

const invalidCode = () => NextResponse.json({ error: "Código inválido." }, { status: 401 });
const minInvalidResponseMs = 200;

async function invalidCodeResponse(startedAt: number, badge: string, ipHash: string) {
  await recordLoginFailure(badge, ipHash);
  const remaining = minInvalidResponseMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return invalidCode();
}

async function readLimitedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return null;
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const ipHash = getLoginClientIpHash(request);
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const body = await readLimitedJson(request);
    if (!body) return invalidCodeResponse(startedAt, "", ipHash);
    const suppliedCode = typeof body.codigoCracha === "string" ? body.codigoCracha : "";
    const badge = normalizeLoginCode(suppliedCode);
    const validCode = /^\d{4,10}$/.test(badge);

    const retryAfter = await getLoginBlockRetryAfter(badge, ipHash);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
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
          await clearBadgeLoginFailures(badge);
          const session = await createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel), device.id);
          return session ?? invalidCode();
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

    await clearBadgeLoginFailures(badge);
    const session = await createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel));
    return session ?? invalidCode();
  } catch (error) {
    if (isLoginAttemptStorageUnavailable(error)) return loginAttemptStorageUnavailableResponse();
    const errorId = randomUUID();
    console.error("Falha no login", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível concluir o login.", errorId }, { status: 500 });
  }
}
