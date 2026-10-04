import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoLivre } from "@/lib/stock-availability";

const LOCAL_ESTOQUE_SLUG = "estoque";
const LOCAL_DEPOSITO_SLUG = "deposito";
const MAX_REQUESTED_ITEMS = 100;

export async function GET(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const requestedIds = new URL(request.url).searchParams.get("itemIds");
  const itemIds = requestedIds === null ? undefined : requestedIds.split(",").filter(Boolean);
  if (
    itemIds &&
    (itemIds.length === 0 ||
      itemIds.length > MAX_REQUESTED_ITEMS ||
      itemIds.some((id) => id.length > 36))
  ) {
    return NextResponse.json({ error: "A lista de itens solicitada é inválida." }, { status: 400 });
  }

  try {
    const items = await prisma.item.findMany({
      where: { ativo: true, ...(itemIds ? { id: { in: itemIds } } : {}) },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        unidade: true,
        pontoPedido: true,
        saldos: {
          where: { local: { slug: { in: [LOCAL_ESTOQUE_SLUG, LOCAL_DEPOSITO_SLUG] } } },
          select: { quantidade: true, reservada: true, local: { select: { slug: true } } },
        },
      },
    });

    return NextResponse.json({
      items: items.map((item) => {
        const stock = item.saldos.find((balance) => balance.local.slug === LOCAL_ESTOQUE_SLUG);
        const deposit = item.saldos.find((balance) => balance.local.slug === LOCAL_DEPOSITO_SLUG);
        const balance = calcularSaldoLivre(stock?.quantidade ?? 0, stock?.reservada ?? 0);
        return {
          itemId: item.id,
          nome: item.nome,
          unidade: item.unidade,
          pontoPedido: item.pontoPedido,
          quantidadeDeposito: deposit?.quantidade ?? 0,
          ...balance,
        };
      }),
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao consultar saldo livre", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Não foi possível consultar o saldo. Tente novamente.", errorId },
      { status: 500 },
    );
  }
}
