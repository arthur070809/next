import bcrypt from "bcryptjs";

export { BADGE_PATTERN } from "./badge-code";
export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function passwordError() {
  return "A senha deve ter pelo menos 12 caracteres, uma letra e um número.";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

function getAllowedForwardedDevOrigin(request: Request): string | null {
  if (process.env.NODE_ENV === "production") return null;

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
  if (!forwardedHost || !forwardedProto || forwardedHost.includes(",") ||
    forwardedProto.includes(",") || !["http", "https"].includes(forwardedProto)) {
    return null;
  }

  let forwardedOrigin: URL;
  try {
    forwardedOrigin = new URL(`${forwardedProto}://${forwardedHost}`);
  } catch {
    return null;
  }
  if (forwardedOrigin.username || forwardedOrigin.password ||
    forwardedOrigin.pathname !== "/" || forwardedOrigin.search || forwardedOrigin.hash) {
    return null;
  }

  const extraOrigins = (process.env.DEV_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of extraOrigins) {
    try {
      const allowed = new URL(value);
      if (!allowed.username && !allowed.password &&
        ["http:", "https:"].includes(allowed.protocol) &&
        allowed.pathname === "/" && !allowed.search && !allowed.hash &&
        allowed.origin === forwardedOrigin.origin) {
        return forwardedOrigin.origin;
      }
    } catch {
      // Ignore malformed development-only configuration entries.
    }
  }
  return null;
}

export function isSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (host && host.toLowerCase() !== requestUrl.host.toLowerCase()) return false;
  const forwardedDevOrigin = getAllowedForwardedDevOrigin(request);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      return parsedOrigin.origin === requestUrl.origin ||
        parsedOrigin.origin === forwardedDevOrigin;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (!referer || !host) return false;
  try {
    const parsedRefererOrigin = new URL(referer).origin;
    return parsedRefererOrigin === requestUrl.origin ||
      parsedRefererOrigin === forwardedDevOrigin;
  } catch {
    return false;
  }
}

export function hasExactOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  const requestUrl = new URL(request.url);
  if (host.toLowerCase() !== requestUrl.host.toLowerCase()) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.origin === requestUrl.origin
      && parsedOrigin.host.toLowerCase() === host.toLowerCase()
      && !parsedOrigin.username
      && !parsedOrigin.password
      && parsedOrigin.pathname === "/"
      && !parsedOrigin.search
      && !parsedOrigin.hash;
  } catch {
    return false;
  }
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const loginFailures = new Map<string, { count: number; blockedUntil: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

export function isLoginBlocked(key: string) {
  const state = loginFailures.get(key);
  return Boolean(state && state.blockedUntil > Date.now());
}

export function recordLoginFailure(key: string) {
  const state = loginFailures.get(key) ?? { count: 0, blockedUntil: 0 };
  state.count += 1;
  if (state.count >= 5) state.blockedUntil = Date.now() + 15 * 60 * 1000;
  loginFailures.set(key, state);
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}
