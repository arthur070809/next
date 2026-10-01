import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const inicioHoje = new Date(`${hoje}T03:00:00.000Z`);
    const amanha = new Date(inicioHoje);
    amanha.setUTCDate(amanha.getUTCDate() + 1);
    const [materiaisAtivos, materiaisSemEstoque, requisicoesPendentes, itensComSobras, sobrasHoje] = await Promise.all([
      prisma.estoqueItem.count({ where: { ativo: true } }),
      prisma.estoqueItem.count({ where: { ativo: true, quantidade: { lte: 0 } } }),
      prisma.requisicao.count({ where: { funcionarioId: funcionario.id, status: "PENDENTE" } }),
      prisma.saldoDeposito.count({ where: { quantidade: { gt: 0 } } }),
      prisma.movimentacaoDeposito.aggregate({
        where: { tipo: { in: ["ENTRADA_SOBRA", "ENTRADA_MANUAL"] }, criadoEm: { gte: inicioHoje, lt: amanha } },
        _sum: { quantidade: true },
      }),
    ]);

    return NextResponse.json({ resumo: {
      materiaisAtivos,
      materiaisSemEstoque,
      requisicoesPendentes,
      itensComSobras,
      sobrasHoje: sobrasHoje._sum.quantidade ?? 0,
    } });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar resumo do almoxarifado", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível carregar o resumo agora.", errorId }, { status: 500 });
  }
}