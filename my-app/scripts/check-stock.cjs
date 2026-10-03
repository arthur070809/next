const { config } = require("dotenv");
config({ path: ".env.local" });
config({ path: ".env" });

const { PrismaClient } = require("../generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurada.");
  const u = new URL(rawUrl);
  u.searchParams.delete("sslaccept");
  const adapter = new PrismaMariaDb(u.toString(), {
    connectionLimit: 1,
    ssl: { rejectUnauthorized: false },
    charset: "utf8mb4",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const totalItens = await prisma.item.count();
    const totalSaldos = await prisma.saldoEstoque.count();
    const totalFuncionarios = await prisma.funcionario.count();
    console.log(`Itens: ${totalItens} | Saldos por local: ${totalSaldos} | Funcionários: ${totalFuncionarios}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Erro ao verificar estoque:", error.message);
  process.exitCode = 1;
});
