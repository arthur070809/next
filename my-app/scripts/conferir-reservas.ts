import { config } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  PrismaClient,
  StatusItemRequisicao,
  StatusRequisicao,
} from "../generated/prisma/client";
import { encontrarDivergenciasReserva } from "../lib/reservation-consistency";

config({ path: ".env.local" });
config({ path: ".env" });

function getTargetDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não foi configurada.");
  const url = new URL(rawUrl);
  return {
    url,
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("reservas:conferir é proibido quando NODE_ENV=production.");
  }

  const target = getTargetDatabase();
  console.log("Conferência somente leitura; nenhum dado será alterado.");
  console.log(`Destino: host=${target.host}; banco=${target.database}`);

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: target.url.hostname,
      port: Number(target.url.port) || 4000,
      user: decodeURIComponent(target.url.username),
      password: decodeURIComponent(target.url.password),
      database: target.database,
      ssl: true,
      connectTimeout: 30000,
      connectionLimit: 1,
      charset: "utf8mb4",
    }),
  });

  try {
    const [balances, openRequestItems] = await Promise.all([
      prisma.saldoEstoque.findMany({
        include: {
          item: { select: { codigo: true, nome: true } },
          local: { select: { nome: true } },
        },
      }),
      prisma.requisicaoItem.groupBy({
        by: ["itemId", "localId"],
        where: {
          status: { in: [StatusItemRequisicao.PENDENTE, StatusItemRequisicao.ASSUMIDO] },
          requisicao: {
            status: { in: [StatusRequisicao.PENDENTE, StatusRequisicao.ASSUMIDA] },
          },
        },
        _sum: { quantidade: true },
      }),
    ]);

    const mismatches = encontrarDivergenciasReserva(
      balances.map((balance) => ({
        itemId: balance.itemId,
        localId: balance.localId,
        fisico: balance.quantidade,
        reservado: balance.reservada,
        codigo: balance.item.codigo,
        nome: balance.item.nome,
        local: balance.local.nome,
      })),
      openRequestItems.map((item) => ({
        itemId: item.itemId,
        localId: item.localId,
        quantidade: item._sum.quantidade ?? 0,
      })),
    );

    if (mismatches.length === 0) {
      console.log("OK: o saldo reservado coincide com as requisições abertas.");
      return;
    }

    console.error(`Encontradas ${mismatches.length} divergência(s):`);
    for (const mismatch of mismatches) {
      console.error([
        `item=${mismatch.codigo ?? mismatch.itemId}`,
        `nome=${mismatch.nome}`,
        `local=${mismatch.local}`,
        `físico=${mismatch.fisico}`,
        `reservado_no_saldo=${mismatch.reservado}`,
        `reservado_pelas_requisições_abertas=${mismatch.esperado}`,
      ].join(" | "));
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Não foi possível conferir as reservas.");
  process.exitCode = 1;
});
