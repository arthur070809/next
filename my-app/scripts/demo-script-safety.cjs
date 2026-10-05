function getDemoTarget(environment) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL não foi configurada.");
  let url;
  try {
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL inválida; operação recusada.");
  }
  if (url.protocol !== "mysql:") throw new Error("Somente destinos MySQL/TiDB são aceitos.");

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const expected = environment.DEMO_DB_NOME?.trim() ?? "";
  if (!database || !expected.endsWith("_demo") || database !== expected || !database.endsWith("_demo")) {
    throw new Error("Operação recusada: DATABASE_URL deve apontar exatamente para DEMO_DB_NOME, terminado em _demo.");
  }
  return { host: url.hostname, database };
}

function assertSafeDemoScript(args, environment = process.env, allowedArgs = ["--yes"]) {
  if (environment.NODE_ENV === "production") {
    throw new Error("Scripts de seed/reset demo são proibidos com NODE_ENV=production.");
  }
  const target = getDemoTarget(environment);
  console.log(`Destino: host=${target.host}; banco=${target.database}`);

  const allowed = new Set(allowedArgs);
  if (
    !args.includes("--yes") ||
    args.filter((arg) => arg === "--yes").length !== 1 ||
    args.some((arg) => !allowed.has(arg))
  ) {
    throw new Error("Operação recusada. Confirme explicitamente usando --yes.");
  }
  return target;
}

module.exports = { assertSafeDemoScript };
