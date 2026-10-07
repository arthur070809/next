import { normalizeLoginCode } from "@/lib/normalize-login-code";
import { getDemoDatabaseTarget } from "@/lib/demo-mode";

export const demoPasswordBadges = ["1111", "2222", "3333"] as const;

export function validateDemoPasswordSeed(input: {
  args: string[];
  nodeEnv?: string;
  vercelEnv?: string;
  databaseUrl?: string;
  demoDatabaseName?: string;
  allowlistedBadges?: string;
}) {
  if (input.args.length !== 1 || input.args[0] !== "--demo") {
    throw new Error("Operação recusada; confirme explicitamente com --demo.");
  }
  if (input.nodeEnv === "production" || input.vercelEnv === "production") {
    throw new Error("Operação recusada em ambiente de produção.");
  }
  if (!input.databaseUrl) {
    throw new Error("Operação recusada: DATABASE_URL não está configurada.");
  }
  const target = getDemoDatabaseTarget(input.databaseUrl);
  const expectedDatabase = input.demoDatabaseName?.trim() ?? "";
  if (!target || !expectedDatabase.endsWith("_demo") || target.database !== expectedDatabase) {
    throw new Error("Operação recusada: DATABASE_URL deve apontar exatamente para DEMO_DB_NOME terminado em _demo.");
  }
  const allowlist = new Set(
    (input.allowlistedBadges ?? "")
      .split(",")
      .map((badge) => normalizeLoginCode(badge))
      .filter((badge) => /^\d{4,10}$/.test(badge)),
  );
  if (demoPasswordBadges.some((badge) => !allowlist.has(badge))) {
    throw new Error("LOGIN_DEMO_CRACHAS deve listar 1111, 2222 e 3333 antes do seed.");
  }
  return target;
}
