import { normalizeLoginCode } from "@/lib/normalize-login-code";

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
