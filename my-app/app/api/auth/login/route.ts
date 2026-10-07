import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
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
import {
  clearTestLoginBadgeFailures,
  getTestLoginBlockRetryAfter,
  isTestLoginEnabledForBadge,
  maskLoginTestBadge,
  recordTestLoginFailure,
} from "@/lib/login-test-mode";
import { isDemoLoginEnabledForBadge, maskDemoBadge } from "@/lib/demo-mode";
import { getLoginAttemptPolicy } from "@/lib/login-attempt-policy";
import { isFaceLoginEnabled } from "@/lib/facial/config";
import { PapelFuncionario } from "@/generated/prisma/client";
import { createSecret, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName, webauthnChallengeTtlMs } from "@/lib/webauthn";

const invalidCode = () => NextResponse.json({ error: "Código inválido." }, { status: 401 });
const minInvalidResponseMs = 200;

async function invalidCodeResponse(
  startedAt: number,
  badge: string,
  ipHash: string,
  localTestMode: boolean,
  policy = getLoginAttemptPolicy(),
) {
  if (localTestMode) recordTestLoginFailure(badge, ipHash);
  else await recordLoginFailure(badge, ipHash, new Date(), policy);
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
    if (!body) return invalidCodeResponse(startedAt, "", ipHash, false);
    const suppliedCode = typeof body.codigoCracha === "string" ? body.codigoCracha : "";
    const badge = normalizeLoginCode(suppliedCode);
    const credential = body.credential;
    const validCode = /^\d{4,10}$/.test(badge);
    const testMode = isTestLoginEnabledForBadge(badge);
    const demoMode = !testMode && isDemoLoginEnabledForBadge(badge);
    const attemptPolicy = getLoginAttemptPolicy(demoMode);

    const retryAfter = testMode
      ? getTestLoginBlockRetryAfter(badge, ipHash)
      : await getLoginBlockRetryAfter(badge, ipHash);
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
      return invalidCodeResponse(startedAt, badge, ipHash, testMode, attemptPolicy);
    }

    if (credential !== undefined && credential !== "password" && credential !== "face") {
      return invalidCodeResponse(startedAt, badge, ipHash, testMode, attemptPolicy);
    }

    if ((testMode || demoMode) && credential !== "face") {
      if (testMode) clearTestLoginBadgeFailures(badge);
      else await clearBadgeLoginFailures(badge);
      const session = await createLoginSessionResponse(funcionario, getLoginAccessArea(funcionario.papel));
      if (!session) return invalidCode();
      if (testMode) {
        console.warn(`[LOGIN TESTE] Login de teste realizado para crachá ${maskLoginTestBadge(badge)}.`);
      } else {
        console.warn(`[LOGIN DEMO] Login de demonstração para crachá ${maskDemoBadge(badge)}.`);
      }
      return session;
    }

    if (credential !== "face") {
      const password = typeof body.password === "string" ? body.password : "";
      const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(funcionario.senha);
      if (!password || password.length > 256 || !isBcryptHash || !(await bcrypt.compare(password, funcionario.senha))) {
        return invalidCodeResponse(startedAt, badge, ipHash, false, attemptPolicy);
      }
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

    if (credential === "face") {
      if (!isFaceLoginEnabled()) return invalidCodeResponse(startedAt, badge, ipHash, false, attemptPolicy);
      if (funcionario.papel !== PapelFuncionario.ADMIN) {
        return invalidCodeResponse(startedAt, badge, ipHash, false, attemptPolicy);
      }
      const faceTemplateCount = await prisma.faceTemplate.count({
        where: { funcionarioId: funcionario.id, revogadoEm: null },
      });
      if (faceTemplateCount === 0) {
        return NextResponse.json(
          { error: "Não há cadastro facial ativo para este funcionário. Procure o administrador." },
          { status: 503 },
        );
      }
      return NextResponse.json(await createLoginFaceChallenge(funcionario.id, ipHash), { status: 202 });
    }

    if (loginRequiresFace(funcionario.papel)) {
      const faceTemplateCount = await prisma.faceTemplate.count({
        where: { funcionarioId: funcionario.id, revogadoEm: null },
      });
      if (faceTemplateCount > 0) {
        return NextResponse.json(await createLoginFaceChallenge(funcionario.id, ipHash), { status: 202 });
      }
    }

    if (funcionario.papel === PapelFuncionario.ALMOXARIFE) {
      const cookieStore = await cookies();
      const deviceToken = cookieStore.get(trustedDeviceCookieName)?.value;
      if (!deviceToken) return invalidCodeResponse(startedAt, badge, ipHash, false, attemptPolicy);

      const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashSecret(deviceToken) } });
      if (!device || device.revogadoEm) return invalidCodeResponse(startedAt, badge, ipHash, false, attemptPolicy);
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

      if (employeeDevice.length === 0) return invalidCodeResponse(startedAt, badge, ipHash, false);
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
    if (error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022")) {
      console.error("[face] Login indisponível: aplique a migration de templates faciais.", { code: error.code });
      return NextResponse.json(
        { error: "O login está temporariamente indisponível. A configuração facial do banco precisa de atualização." },
        { status: 503 },
      );
    }
    const errorId = randomUUID();
    console.error("Falha no login", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível concluir o login.", errorId }, { status: 500 });
  }
}
