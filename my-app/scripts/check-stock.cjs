const { PrismaClient } = require("../generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

async function main() {
  console.log("Conectando ao banco...");
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL),
  });
  const total = await prisma.estoqueItem.count();
  console.log(`Itens atuais: ${total}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
