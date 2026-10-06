import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusRequisicao, TipoMovimentacao } from "@/generated/prisma/client";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const inicioHoje = new Date(`${today}T03:00:00.000Z`);
    const amanha = new Date(inicioHoje);
    amanha.setUTCDate(amanha.getUTCDate() + 1);
    const [materiaisAtivos, materiaisSemEstoque, requisicoesPendentes, itensComSobras, sobrasHoje] = await Promise.all([
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
      prisma.movimentacao.aggregate({
        where: {
          tipo: TipoMovimentacao.ENTRADA,
          saldoEstoque: { local: { slug: "deposito" } },
          criadoEm: { gte: inicioHoje, lt: amanha },
        },
        _sum: { quantidade: true },
      }),
    ]);

    return NextResponse.json({
      resumo: {
        materiaisAtivos,
        materiaisSemEstoque,
        requisicoesPendentes,
        itensComSobras,
        sobrasHoje: sobrasHoje._sum.quantidade ?? 0,
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