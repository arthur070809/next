import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario, StatusRequisicao } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  planejarViagens,
  type RequisicaoViagemInput,
} from "@/lib/viagem/planejar-viagens";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const requisicoes = await prisma.requisicao.findMany({
      where: { status: StatusRequisicao.PENDENTE },
      select: {
        id: true,
        numeroPedido: true,
        prioridade: true,
        criadoEm: true,
        itens: {
          select: {
            itemId: true,
            quantidade: true,
            item: { select: { nome: true } },
            local: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }],
      take: 200,
    });

    const requisicoesParaPlanejamento: RequisicaoViagemInput[] =
      requisicoes.map((requisicao) => ({
        id: requisicao.id,
        numeroPedido: requisicao.numeroPedido,
        prioridade: requisicao.prioridade,
        criadoEm: requisicao.criadoEm,
        itens: requisicao.itens.map((item) => ({
          itemId: item.itemId,
          nome: item.item.nome,
          quantidade: item.quantidade,
          local: item.local,
        })),
      }));

    return NextResponse.json(planejarViagens(requisicoesParaPlanejamento), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorId = randomUUID();
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Falha ao montar viagens de requisições.", { errorId, errorName });
    return NextResponse.json(
      { error: "Não foi possível montar as viagens.", errorId },
      { status: 500 },
    );
  }
}
