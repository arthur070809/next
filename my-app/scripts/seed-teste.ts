import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

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

function getTargetDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não foi configurada.");
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    url,
  };
}

function isOwnedTestAccount(employee: { nome: string; email: string }, expected: typeof testEmployees[number]) {
  return employee.nome.startsWith("TESTE ") && employee.email === expected.email;
}

async function confirmAction(action: string, target: { host: string; database: string }, yes: boolean) {
  console.log(`Destino: host=${target.host}; banco=${target.database}`);
  console.log(`Ação: ${action}`);
  if (yes) return;
  if (!stdin.isTTY) {
    throw new Error("Confirmação interativa indisponível. Revise o destino e repita com --yes.");
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question("Confirma esta operação? Digite SIM para continuar: ");
    if (answer.trim() !== "SIM") throw new Error("Operação cancelada.");
  } finally {
    prompt.close();
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:teste é proibido quando NODE_ENV=production.");
  }

  const args = new Set(process.argv.slice(2));
  if ([...args].some((arg) => arg !== "--yes" && arg !== "--remove")) {
    throw new Error("Uso: npm run seed:teste -- [--yes] [--remove].");
  }
  const remove = args.has("--remove");
  const target = getTargetDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
    host: target.url.hostname,
    port: Number(target.url.port) || 4000,
    user: decodeURIComponent(target.url.username),
    password: decodeURIComponent(target.url.password),
    database: target.database,
    ssl: true,
    connectTimeout: 30000,
    connectionLimit: 1,
    charset: "utf8mb4",
  }) });

  try {
    await confirmAction(
      remove
        ? "remover exclusivamente as três contas TESTE listadas"
        : "criar/atualizar exclusivamente as três contas TESTE listadas",
      target,
      args.has("--yes"),
    );

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
