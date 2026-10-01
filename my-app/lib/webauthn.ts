import { createHash, randomBytes } from "node:crypto";

export const trustedDeviceCookieName = "marcon_trusted_device";
export const webauthnUserConsentVersion = "webauthn-local-verification-v1";
export const pairingCodeTtlMs = 5 * 60 * 1000;
export const webauthnChallengeTtlMs = 60 * 1000;
export const emergencyGrantTtlMs = 15 * 60 * 1000;

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createSecret(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function getClientIpHash(request: Request) {
  const forwardedIp = request.headers.get("x-real-ip")?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  return hashSecret(forwardedIp);
}

export function getWebAuthnRelyingParty(requestUrl?: string) {
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN;
  const fallbackOrigin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl ?? "http://localhost:3000";
  const originUrl = new URL(configuredOrigin ?? fallbackOrigin);
  if (process.env.NODE_ENV === "production" && originUrl.protocol !== "https:") {
    throw new Error("WEBAUTHN_ORIGIN must use HTTPS in production.");
  }

  const rpId = process.env.WEBAUTHN_RP_ID ?? originUrl.hostname;
  if (rpId !== originUrl.hostname && !originUrl.hostname.endsWith(`.${rpId}`)) {
    throw new Error("WEBAUTHN_RP_ID must match the configured origin host.");
  }

  return {
    rpID: rpId,
    rpName: process.env.WEBAUTHN_RP_NAME ?? "Almoxarifado Marcon",
    origin: originUrl.origin,
  };
}