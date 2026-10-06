import { normalizeLoginCode } from "@/lib/normalize-login-code";

export type DemoDatabaseTarget = {
  host: string;
  database: string;
};

export function getDemoDatabaseTarget(
  databaseUrl = process.env.DATABASE_URL,
): DemoDatabaseTarget | null {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "mysql:") return null;
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!database) return null;
    return { host: url.hostname, database };
  } catch {
    return null;
  }
}

export function getDemoLoginBadges() {
  return new Set(
    (process.env.LOGIN_DEMO_CRACHAS ?? "")
      .split(",")
      .map((badge) => normalizeLoginCode(badge))
      .filter((badge) => /^\d{4,10}$/.test(badge)),
  );
}

export function isDemoModeConfigured(): boolean {
  const requestedDatabase = process.env.DEMO_DB_NOME?.trim() ?? "";
  const target = getDemoDatabaseTarget();
  return process.env.LOGIN_MODO_DEMO === "true" &&
    requestedDatabase.endsWith("_demo") &&
    target?.database === requestedDatabase &&
    getDemoLoginBadges().size > 0;
}

export function isDemoLoginEnabledForBadge(badge: string): boolean {
  return isDemoModeConfigured() && getDemoLoginBadges().has(normalizeLoginCode(badge));
}

export function maskDemoBadge(badge: string): string {
  const normalized = normalizeLoginCode(badge);
  return `${"*".repeat(Math.max(0, normalized.length - 2))}${normalized.slice(-2)}`;
}

export function logLoginDemoModeStartup(): void {
  const requested = process.env.LOGIN_MODO_DEMO === "true" ||
    Boolean(process.env.DEMO_DB_NOME?.trim()) ||
    Boolean(process.env.LOGIN_DEMO_CRACHAS?.trim());
  if (!requested) return;

  if (!isDemoModeConfigured()) {
    console.warn("[LOGIN DEMO] Modo não ativado: confira as flags, a allowlist e o destino _demo configurado.");
    return;
  }

  const target = getDemoDatabaseTarget();
  console.warn(`[LOGIN DEMO] MODO DE DEMONSTRAÇÃO ATIVO para o banco ${target?.database}.`);
}
