import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { assertSafeDemoScript } from "./demo-script-safety.cjs";

config({ path: ".env.local" });
config({ path: ".env" });

const testEmployees = [
  {
    cracha: "1111",
    nome: "TESTE Operador",
    email: "teste-operador@local.invalid",
    cargo: "Operador de teste",
    papel: "OPERADOR",
  },
  {
    cracha: "2222",
    nome: "TESTE Almoxarife",
    email: "teste-almoxarife@local.invalid",
    cargo: "Almoxarife de teste",
    papel: "ALMOXARIFE",
  },
  {
    cracha: "3333",
    nome: "TESTE Administrador",
    email: "teste-administrador@local.invalid",
    cargo: "Administrador de teste",
    papel: "ADMIN",
  },
] as const;

function isOwnedTestAccount(employee: { nome: string; email: string }, expected: typeof testEmployees[number]) {
  return employee.nome.startsWith("TESTE ") && employee.email === expected.email;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--yes" && arg !== "--remove")) {
    throw new Error("Uso: npm run seed:teste -- --yes [--remove].");
  }
  const target = assertSafeDemoScript(args, process.env, ["--yes", "--remove"]);
  const remove = args.includes("--remove");
  console.log(`Ação: ${remove ? "remover apenas as contas TESTE descritas neste script" : "criar/atualizar apenas as contas TESTE descritas neste script"}`);
  const url = new URL(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
    host: target.host,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: target.database,
    ssl: true,
    connectTimeout: 30000,
    connectionLimit: 1,
    charset: "utf8mb4",
  }) });

  try {
    const existing = await prisma.funcionario.findMany({
      where: { cracha: { in: testEmployees.map(({ cracha }) => cracha) } },
      select: { id: true, cracha: true, nome: true, email: true },
    });
    for (const employee of existing) {
      const expected = testEmployees.find(({ cracha }) => cracha === employee.cracha);
      if (!expected || !isOwnedTestAccount(employee, expected)) {
        throw new Error(
          `O crachá ${employee.cracha} já pertence a uma conta que não é deste seed; operação cancelada sem alterações.`,
        );
      }
    }

    if (remove) {
      if (existing.length === 0) {
        console.log("Nenhuma conta TESTE correspondente foi encontrada.");
        return;
      }
      let removedCount = 0;
      try {
        const result = await prisma.funcionario.deleteMany({
          where: {
            id: { in: existing.map(({ id }) => id) },
            cracha: { in: testEmployees.map(({ cracha }) => cracha) },
            nome: { startsWith: "TESTE " },
            email: { in: testEmployees.map(({ email }) => email) },
          },
        });
        removedCount = result.count;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2003"
        ) {
          throw new Error(
            "As contas têm registros de negócio/auditoria protegidos por chave estrangeira; nenhuma conta foi removida. Revise e remova os dados de teste dependentes antes de repetir.",
          );
        }
        throw error;
      }
      console.log(`Contas TESTE removidas: ${removedCount}. Relações com exclusão em cascata foram removidas pelo banco.`);
      return;
    }

    const rows = await Promise.all(testEmployees.map(async (employee) => ({
      ...employee,
      senha: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      ativo: true,
      mustChangePassword: false,
    })));

    await prisma.$transaction(
      rows.map(({ cracha, ...data }) => prisma.funcionario.upsert({
        where: { cracha },
        create: { cracha, ...data },
        update: {
          nome: data.nome,
          email: data.email,
          senha: data.senha,
          cargo: data.cargo,
          papel: data.papel,
          ativo: data.ativo,
          mustChangePassword: data.mustChangePassword,
        },
      })),
    );
    console.log("As três contas TESTE foram configuradas. As senhas aleatórias não são usadas no login por código.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed de teste:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
