/**
 * Redefine a senha do Administrador com confirmação de segurança.
 * Uso:
 *   CONFIRM_ADMIN_RESET=YES ADMIN_LOGIN=admin ADMIN_PASSWORD=nova-senha npm run admin:reset-password
 */
const { config } = require("dotenv");
config({ path: ".env.local" });
config({ path: ".env" });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

function getPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurada.");
  const u = new URL(rawUrl);
  u.searchParams.delete("sslaccept");
  const adapter = new PrismaMariaDb(u.toString(), {
    connectionLimit: 1,
    idleTimeout: 30,
    connectTimeout: 20000,
    acquireTimeout: 30000,
    charset: "utf8mb4",
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter });
}

async function main() {
  if (process.env.CONFIRM_ADMIN_RESET !== "YES") {
    throw new Error("Confirme o reset com CONFIRM_ADMIN_RESET=YES.");
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_PASSWORD_RESET !== "true") {
    throw new Error("Reset bloqueado em produção. Defina ALLOW_ADMIN_PASSWORD_RESET=true explicitamente.");
  }
  const { ADMIN_LOGIN, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    throw new Error("Defina ADMIN_LOGIN e ADMIN_PASSWORD.");
  }

  const login = ADMIN_LOGIN.trim().toLowerCase();
  const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const prisma = getPrismaClient();

  try {
    const admin = await prisma.funcionario.update({
      where: { login },
      data: {
        senha: senhaHash,
        mustChangePassword: false,
        ativo: true,
      },
    });
    console.log(`Senha do administrador "${admin.login}" redefinida com sucesso.`);
  } catch {
    throw new Error(`Administrador "${login}" não encontrado.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Erro ao resetar senha:", error.message);
  process.exitCode = 1;
});