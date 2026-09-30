import bcrypt from "bcryptjs";

export const BADGE_PATTERN = /^\d{4,10}$/;
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

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
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