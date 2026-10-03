// Script para aplicar a migration no banco de teste usando o prisma CLI
// Executa: node scripts/migrate-test-db.cjs
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { execSync } = require("child_process");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL não configurada.");
  process.exitCode = 1;
  process.exit();
}

// Substitui o banco na URL para apontar para o banco de teste
const testUrl = databaseUrl.replace(
  /\/marcon_almoxarifado([?]|$)/,
  "/marcon_almoxarifado_test$1"
);

console.log("Aplicando migration no banco de teste...");

try {
  execSync("npx prisma migrate deploy --config prisma7.config.ts", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
    cwd: process.cwd(),
  });
  console.log("Migration aplicada com sucesso no banco de teste.");
} catch (error) {
  console.error("Falha ao aplicar migration:", error.message);
  process.exitCode = 1;
}
