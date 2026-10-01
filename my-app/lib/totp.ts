import { Secret, TOTP } from "otpauth";

export const totpPeriodSeconds = 30;

export function createTotpSecret(login: string) {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({ issuer: "Almoxarifado Marcon", label: login, secret, digits: 6, period: totpPeriodSeconds });
  return { secret: secret.base32, uri: totp.toString() };
}

export function verifyTotp(secret: string, token: string, now = Date.now()) {
  if (!/^\d{6}$/.test(token)) return null;
  const totp = new TOTP({ issuer: "Almoxarifado Marcon", label: "admin", secret, digits: 6, period: totpPeriodSeconds });
  const delta = totp.validate({ token, window: 1, timestamp: now });
  return delta === null ? null : Math.floor(now / (totpPeriodSeconds * 1000)) + delta;
}