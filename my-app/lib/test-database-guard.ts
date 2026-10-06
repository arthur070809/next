export function assertTestDatabaseUrl(databaseUrl: string | undefined): void {
  let databaseName = "";
  try {
    const url = new URL(databaseUrl ?? "");
    if (url.protocol !== "mysql:") throw new Error("Unsupported database protocol.");
    databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Integration tests require a MySQL DATABASE_URL whose database name ends in _test.");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error("Integration tests refused to run: DATABASE_URL database name must end in _test.");
  }
}
