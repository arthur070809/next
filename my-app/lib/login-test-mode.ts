import { normalizeLoginCode } from "@/lib/normalize-login-code";

const testLoginLimit = 5;
const testLoginWindowMs = 15 * 60 * 1000;
const testLoginBlockMs = 15 * 60 * 1000;
const failures = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>();

export function getTestLoginBadges() {
  return new Set(
    (process.env.LOGIN_TESTE_CRACHAS ?? "")
      .split(",")
      .map((badge) => normalizeLoginCode(badge))
      .filter((badge) => /^\d{4,10}$/.test(badge)),
  );
}

export function isTestLoginModeConfigured() {
  return process.env.LOGIN_MODO_TESTE === "true" && getTestLoginBadges().size > 0;
}

export function isTestLoginEnabledForBadge(badge: string) {
  return process.env.NODE_ENV !== "production" &&
    isTestLoginModeConfigured() &&
    getTestLoginBadges().has(normalizeLoginCode(badge));
}

function failureKey(scope: "badge" | "ip", value: string) {
  return `${scope}:${value}`;
}

export function getTestLoginBlockRetryAfter(badge: string, ipHash: string, now = Date.now()) {
  const keys = [failureKey("badge", normalizeLoginCode(badge)), failureKey("ip", ipHash)];
  let retryAfter: number | null = null;
  for (const key of keys) {
    const state = failures.get(key);
    if (!state) continue;
    if (state.blockedUntil > now) {
      retryAfter = Math.max(retryAfter ?? 0, Math.ceil((state.blockedUntil - now) / 1000));
    } else if (now - state.windowStartedAt >= testLoginWindowMs) {
      failures.delete(key);
    }
  }
  return retryAfter;
}

export function recordTestLoginFailure(badge: string, ipHash: string, now = Date.now()) {
  const keys = [
    failureKey("badge", normalizeLoginCode(badge)),
    failureKey("ip", ipHash),
  ];
  for (const key of keys) {
    const current = failures.get(key);
    const state = !current || now - current.windowStartedAt >= testLoginWindowMs
      ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
      : current;
    state.count += 1;
    if (state.count >= testLoginLimit) state.blockedUntil = now + testLoginBlockMs;
    failures.set(key, state);
  }
}

export function clearTestLoginBadgeFailures(badge: string) {
  failures.delete(failureKey("badge", normalizeLoginCode(badge)));
}

export function maskLoginTestBadge(badge: string) {
  const normalized = normalizeLoginCode(badge);
  return `${"*".repeat(Math.max(0, normalized.length - 2))}${normalized.slice(-2)}`;
}

export function logLoginTestModeStartup() {
  const requested = process.env.LOGIN_MODO_TESTE === "true" ||
    Boolean(process.env.LOGIN_TESTE_CRACHAS?.trim());
  if (!requested) return;

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[LOGIN TESTE] AVISO: LOGIN_MODO_TESTE e LOGIN_TESTE_CRACHAS foram ignorados porque NODE_ENV=production.",
    );
    return;
  }

  if (!isTestLoginModeConfigured()) {
    console.warn(
      "[LOGIN TESTE] Modo não ativado: configure LOGIN_MODO_TESTE=true e pelo menos um crachá válido em LOGIN_TESTE_CRACHAS.",
    );
    return;
  }

  console.warn([
    "",
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    "!!  MODO DE TESTE DE LOGIN ATIVO — DESENVOLVIMENTO LOCAL   !!",
    "!!  Os crachás explicitamente allowlisted ignoram fatores   !!",
    "!!  adicionais. NUNCA habilite esta opção em produção.      !!",
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    "",
  ].join("\n"));
}
