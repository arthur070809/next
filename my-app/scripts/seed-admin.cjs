/**
 * Cria ou atualiza a conta do Administrador real do sistema.
 * Uso:
 *   ADMIN_LOGIN="admin" ADMIN_PASSWORD="sua-senha-forte" npm run seed:admin
 */
const { config } = require("dotenv");
config({ path: ".env.local" });
config({ path: ".env" });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const mariadb = require("mariadb");

function getPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurada.");
  const u = new URL(rawUrl);
  const pool = mariadb.createPool({
    host: u.hostname,
    port: Number(u.port) || 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
    ssl: true,
    connectTimeout: 30000,
    connectionLimit: 1,
    charset: "utf8mb4",
  });
  const adapter = new PrismaMariaDb(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

async function main() {
  const { ADMIN_LOGIN, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    throw new Error(
      "Defina ADMIN_LOGIN e ADMIN_PASSWORD no ambiente ou .env.local para criar o administrador."
    );
  }

  const login = ADMIN_LOGIN.trim().toLowerCase();
  const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const nome = process.env.ADMIN_NAME || "Administrador do Sistema";
  const { prisma, pool } = getPrismaClient();

  try {
    const admin = await prisma.funcionario.upsert({
      where: { login },
      create: {
        nome,
        login,
        email: `${login}@marcon.com.br`,
        cracha: "ADMIN",
        cargo: "Administrador de TI",
        papel: "ADMIN",
        senha: senhaHash,
        mustChangePassword: false,
        ativo: true,
      },
      update: {
        nome,
        senha: senhaHash,
        papel: "ADMIN",
        mustChangePassword: false,
        ativo: true,
      },
    });

    console.log(`Administrador "${admin.login}" configurado com sucesso (ID: ${admin.id}).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Erro ao configurar admin:", error.message);
  process.exitCode = 1;
});