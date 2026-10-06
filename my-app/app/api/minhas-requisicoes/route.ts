import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeItemDescription } from "@/lib/requisition-metadata";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (funcionario.papel !== PapelFuncionario.OPERADOR) {
    return NextResponse.json({ error: "Acesso permitido apenas ao operador." }, { status: 403 });
  }

  try {
    const requisicoes = await prisma.requisicao.findMany({
      where: { solicitanteId: funcionario.id },
      orderBy: { criadoEm: "desc" },
      take: 100,
      select: {
        id: true,
        numeroPedido: true,
        status: true,
        prioridade: true,
        criadoEm: true,
        itens: {
          select: {
            id: true,
            quantidade: true,
            unidadeMedida: true,
            descricao: true,
            motivoNaoAtendido: true,
            item: { select: { nome: true, codigo: true } },
            movimentacoes: {
              where: { tipo: "SAIDA" },
              select: { quantidade: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      requisicoes: requisicoes.map((requisicao) => ({
        numeroPedido: requisicao.numeroPedido,
        status: requisicao.status,
        criadoEm: requisicao.criadoEm.toISOString(),
        prioridade: requisicao.prioridade === "PRIORITARIO" ? "prioridade" : "padrao",
        itens: requisicao.itens.map((item) => ({
          nome: item.item.nome,
          codigo: item.item.codigo,
          quantidadePedida: item.quantidade,
          quantidadeSeparada: item.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0),
          unidadeMedida: item.unidadeMedida,
          descricao: decodeItemDescription(item.descricao).descricao,
          motivo: item.motivoNaoAtendido,
        })),
      })),
      limite: 100,
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar requisições do operador.", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível carregar suas requisições.", errorId }, { status: 500 });
  }
}
