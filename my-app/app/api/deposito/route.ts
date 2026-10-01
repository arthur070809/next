import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const busca = params.get("q")?.trim() ?? "";
    const mostrarZerados = params.get("zerados") === "true";
    const itens = await prisma.estoqueItem.findMany({
      where: {
        ativo: true,
        ...(busca ? { OR: [
          { nome: { contains: busca } },
          { categoria: { contains: busca } },
          { codigo: { contains: busca } },
        ] } : {}),
        ...(!mostrarZerados && !busca ? { deposito: { is: { quantidade: { gt: 0 } } } } : {}),
      },
      orderBy: [{ nome: "asc" }],
      include: {
        deposito: { select: { quantidade: true, atualizadoEm: true } },
        movimentacoesDeposito: { orderBy: { criadoEm: "desc" }, take: 1, select: { criadoEm: true } },
      },
    });
    return NextResponse.json({ itens: itens.map((item) => ({
      id: item.id,
      nome: item.nome,
      codigo: item.codigo,
      categoria: item.categoria,
      quantidade: item.deposito?.quantidade ?? 0,
      ultimaMovimentacaoEm: item.movimentacoesDeposito[0]?.criadoEm ?? null,
    })) });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar saldos do depósito", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar o depósito.", errorId }, { status: 500 });
  }
}