import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "dotenv";
import {
  PapelFuncionario,
  TipoMovimentacao,
} from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import {
  canRemoveDemoRequest,
  demoRequestMarker,
  demoRequestProducts,
  matchesDemoRequest,
} from "../lib/requisition-test-seed";

config({ path: ".env.local" });
config({ path: ".env" });

const operatorBadge = "1111";

function getTargetDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não foi configurada.");
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
  };
}

async function confirmAction(
  action: string,
  target: { host: string; database: string },
  yes: boolean,
) {
  console.log(`Destino: host=${target.host}; banco=${target.database}`);
  console.log(`Ação: ${action}`);
  if (yes) return;
  if (!stdin.isTTY) {
    throw new Error("Confirmação indisponível. Revise o destino e repita com --yes.");
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question("Confirma esta operação? Digite SIM para continuar: ");
    if (answer.trim() !== "SIM") throw new Error("Operação cancelada.");
  } finally {
    prompt.close();
  }
}

async function removeDemoRequest(prisma: PrismaClient, operatorId: number) {
  const requests = await prisma.requisicao.findMany({
    where: { observacao: demoRequestMarker },
    include: { itens: { include: { item: { select: { codigo: true } } } } },
  });
  if (requests.length === 0) {
    console.log("Nenhuma requisição criada por este seed foi encontrada.");
    return;
  }
  if (requests.length !== 1) {
    throw new Error("Há mais de uma requisição com o marcador deste seed; nenhuma alteração foi feita.");
  }

  const request = requests[0];
  if (!matchesDemoRequest(request, operatorId)) {
    throw new Error("A requisição marcada não corresponde aos dados deste seed; nenhuma alteração foi feita.");
  }
  if (!canRemoveDemoRequest(request)) {
    throw new Error(
      "A requisição já teve itens conferidos/resolvidos; não será removida para evitar alterar consumo real de estoque.",
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of request.itens) {
      const released = await tx.saldoEstoque.updateMany({
        where: {
          itemId: item.itemId,
          localId: item.localId,
          reservada: { gte: item.quantidade },
        },
        data: { reservada: { decrement: item.quantidade } },
      });
      if (released.count !== 1) {
        throw new Error("Reserva de estoque não corresponde à requisição; operação cancelada.");
      }
    }

    await tx.movimentacao.deleteMany({
      where: {
        requisicaoId: request.id,
        tipo: TipoMovimentacao.RESERVA,
        observacao: demoRequestMarker,
      },
    });
    await tx.requisicao.delete({ where: { id: request.id } });
  });
  console.log(`Requisição TESTE ${request.numeroPedido} removida e reservas liberadas.`);
}

async function seedDemoRequest(prisma: PrismaClient, operatorId: number) {
  const existingRequests = await prisma.requisicao.findMany({
    where: { observacao: demoRequestMarker },
    include: {
      solicitante: { select: { id: true, cracha: true, nome: true } },
      itens: { include: { item: { select: { codigo: true } } } },
    },
  });
  if (existingRequests.length > 0) {
    if (
      existingRequests.length !== 1 ||
      existingRequests[0].solicitanteId !== operatorId ||
      existingRequests[0].solicitante.cracha !== operatorBadge ||
      !matchesDemoRequest(existingRequests[0], operatorId)
    ) {
      throw new Error("O marcador deste seed já está associado a outros dados; nenhuma alteração foi feita.");
    }
    console.log(`Requisição TESTE já existente: ${existingRequests[0].numeroPedido} (${existingRequests[0].status}).`);
    return;
  }

  const local = await prisma.localEstoque.findUnique({
    where: { slug: "estoque" },
    select: { id: true, ativo: true },
  });
  if (!local?.ativo) throw new Error('Local de estoque ativo "estoque" não encontrado.');

  const selectedProducts = [];
  for (const requestedProduct of demoRequestProducts) {
    const matches = await prisma.item.findMany({
      where: { codigo: requestedProduct.codigo, ativo: true },
      select: { id: true, codigo: true, nome: true },
      take: 2,
    });
    if (matches.length !== 1) {
      throw new Error(`Produto ${requestedProduct.codigo} inexistente ou duplicado; nenhum dado foi criado.`);
    }
    const product = matches[0];
    const stock = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: product.id, localId: local.id } },
      select: { quantidade: true, reservada: true },
    });
    if (!stock || stock.quantidade - stock.reservada < requestedProduct.quantidade) {
      throw new Error(`Saldo insuficiente para ${requestedProduct.codigo}; nenhum dado foi criado.`);
    }
    selectedProducts.push({ ...requestedProduct, itemId: product.id });
  }

  const { criarRequisicao } = await import("../lib/requisicoes-db");
  const request = await criarRequisicao({
    solicitanteId: operatorId,
    prioridade: "padrao",
    observacao: demoRequestMarker,
    movimentacaoObservacao: demoRequestMarker,
    itens: selectedProducts.map(({ itemId, quantidade }) => ({
      itemId,
      localId: local.id,
      quantidade,
      unidadeMedida: "UN",
      descricao: demoRequestMarker,
    })),
  });
  console.log(`Requisição TESTE ${request.numeroPedido} criada para assumir pela fila.`);
  console.log(`Produtos (código ERP/TOTVS): ${demoRequestProducts.map(({ codigo, quantidade }) => `${codigo} x ${quantidade}`).join(", ")}.`);
}

async function main() {
  console.warn("***** AVISO: o banco configurado é COMPARTILHADO com Arthur. Revise cuidadosamente o destino. *****");
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:requisicao é proibido quando NODE_ENV=production.");
  }

  const args = new Set(process.argv.slice(2));
  if ([...args].some((arg) => arg !== "--yes" && arg !== "--remove")) {
    throw new Error("Uso: npm run seed:requisicao -- [--yes] [--remove].");
  }
  const target = getTargetDatabase();
  await confirmAction(
    args.has("--remove")
      ? "remover somente a requisição de demonstração deste seed e suas reservas"
      : "criar uma requisição de demonstração com quatro produtos existentes",
    target,
    args.has("--yes"),
  );

  const { prisma } = await import("../lib/prisma");
  try {
    const operator = await prisma.funcionario.findFirst({
      where: { cracha: operatorBadge, ativo: true },
      select: { id: true, nome: true, papel: true },
    });
    if (
      !operator ||
      !operator.nome.startsWith("TESTE ") ||
      operator.papel !== PapelFuncionario.OPERADOR
    ) {
      throw new Error("O funcionário TESTE operador do crachá 1111 não está ativo; execute seed:teste antes.");
    }

    if (args.has("--remove")) {
      await removeDemoRequest(prisma, operator.id);
    } else {
      await seedDemoRequest(prisma, operator.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed da requisição:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
