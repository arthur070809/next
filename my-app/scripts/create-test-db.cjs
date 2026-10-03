// Script para criar o banco de teste marcon_almoxarifado_test no TiDB
// Executa via: node scripts/create-test-db.cjs
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const mariadb = require("mariadb");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

  const url = new URL(databaseUrl);
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: true,
    connectTimeout: 30000,
    charset: "utf8mb4",
  });

  try {
    await connection.query(
      "CREATE DATABASE IF NOT EXISTS `marcon_almoxarifado_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    console.log("Banco marcon_almoxarifado_test criado (ou já existia).");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Erro ao criar banco de teste:", error.message);
  process.exitCode = 1;
});
