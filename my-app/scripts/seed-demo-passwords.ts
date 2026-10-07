import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { validateDemoPasswordSeed, demoPasswordBadges } from "../lib/demo-password-seed";
import { createDemoScriptClient } from "./demo-script-runtime";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  validateDemoPasswordSeed({
    args: process.argv.slice(2),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    databaseUrl: process.env.DATABASE_URL,
    demoDatabaseName: process.env.DEMO_DB_NOME,
    allowlistedBadges: process.env.LOGIN_DEMO_CRACHAS,
  });
  const { prisma } = createDemoScriptClient(["--yes"]);
  try {
    for (const cracha of demoPasswordBadges) {
      const employee = await prisma.funcionario.findFirst({
        where: { cracha },
        select: { id: true, senha: true },
      });
      if (!employee) throw new Error(`Crachá demo ${cracha} não encontrado no banco demo.`);
      if (await bcrypt.compare(cracha, employee.senha)) {
        console.log(`Senha demo já configurada para o crachá ${cracha}.`);
        continue;
      }
      const senha = await bcrypt.hash(cracha, 12);
      await prisma.funcionario.update({ where: { id: employee.id }, data: { senha } });
      console.log(`Senha demo configurada para o crachá ${cracha}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed de senhas demo recusado ou falhou:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
