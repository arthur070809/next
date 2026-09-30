const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const bcrypt = require("bcryptjs");
const mariadb = require("mariadb");

async function main() {
  const { DATABASE_URL, ADMIN_LOGIN, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !ADMIN_LOGIN || !ADMIN_PASSWORD) throw new Error("Defina DATABASE_URL, ADMIN_LOGIN e ADMIN_PASSWORD.");
  if (ADMIN_LOGIN !== "admin") throw new Error("ADMIN_LOGIN deve ser admin.");
  const url = new URL(DATABASE_URL);
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port) || 3306, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), charset: "utf8mb4" });
  try {
    const senha = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const rows = await connection.query("SELECT id, login FROM funcionarios WHERE login = ? OR cracha = 'ADMIN' LIMIT 1", [ADMIN_LOGIN]);
    if (rows.length) {
      if (rows[0].login === null) await connection.query("UPDATE funcionarios SET login = ?, role = 'admin', ativo = 1, mustChangePassword = 0 WHERE id = ?", [ADMIN_LOGIN, rows[0].id]);
      else await connection.query("UPDATE funcionarios SET login = ?, role = 'admin', ativo = 1, mustChangePassword = 0 WHERE id = ?", [ADMIN_LOGIN, rows[0].id]);
    } else {
      await connection.query("INSERT INTO funcionarios (nome, login, email, senha, cargo, cracha, role, mustChangePassword, ativo) VALUES (?, ?, ?, ?, 'admin', 'ADMIN', 'admin', 0, 1)", [process.env.ADMIN_NAME || "Administrador", ADMIN_LOGIN, "admin@local.invalid", senha]);
    }
  } finally { await connection.end(); }
  console.log("Admin inicial criado ou atualizado.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });