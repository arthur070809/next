import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusRequisicao } from "@/generated/prisma/client";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const [materiaisAtivos, materiaisSemEstoque, requisicoesPendentes, itensComSobras] = await Promise.all([
      prisma.item.count({ where: { ativo: true } }),
      prisma.saldoEstoque.count({
        where: {
          local: { slug: "estoque" },
          quantidade: { lte: 0 },
          item: { ativo: true },
        },
      }),
      prisma.requisicao.count({
        where: { status: StatusRequisicao.PENDENTE },
      }),
      prisma.saldoEstoque.count({
        where: {
          local: { slug: "deposito" },
          quantidade: { gt: 0 },
        },
      }),
    ]);

    return NextResponse.json({
      resumo: {
        materiaisAtivos,
        materiaisSemEstoque,
        requisicoesPendentes,
        itensComSobras,
      },
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar resumo do almoxarifado", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível carregar o resumo agora.", errorId }, { status: 500 });
  }
}