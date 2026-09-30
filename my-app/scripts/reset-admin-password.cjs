const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const bcrypt = require("bcryptjs");
const mariadb = require("mariadb");

async function main() {
  if (process.env.CONFIRM_ADMIN_RESET !== "YES") throw new Error("Confirme o reset com CONFIRM_ADMIN_RESET=YES.");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_PASSWORD_RESET !== "true") throw new Error("Reset bloqueado em produção. Defina ALLOW_ADMIN_PASSWORD_RESET=true explicitamente.");
  const { DATABASE_URL, ADMIN_LOGIN, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !ADMIN_LOGIN || !ADMIN_PASSWORD) throw new Error("Defina DATABASE_URL, ADMIN_LOGIN e ADMIN_PASSWORD.");
  if (ADMIN_LOGIN !== "admin") throw new Error("ADMIN_LOGIN deve ser admin.");

  const url = new URL(DATABASE_URL);
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port) || 3306, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), charset: "utf8mb4" });
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const result = await connection.query("UPDATE funcionarios SET senha = ?, mustChangePassword = 0, ativo = 1, role = 'admin' WHERE login = ?", [hash, ADMIN_LOGIN]);
    if (result.affectedRows !== 1) throw new Error("Conta admin não encontrada.");
  } finally { await connection.end(); }
  console.log("Senha do admin redefinida; a troca não é obrigatória para admins.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });