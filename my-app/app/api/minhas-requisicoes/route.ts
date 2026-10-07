import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeItemDescription } from "@/lib/requisition-metadata";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (funcionario.papel !== PapelFuncionario.OPERADOR) {
    return NextResponse.json({ error: "Acesso permitido apenas ao operador." }, { status: 403 });
  }

  const rawPage = new URL(request.url).searchParams.get("page");
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
    return NextResponse.json({ error: "Página inválida." }, { status: 400 });
  }

  try {
    const requisicoesComMais = await prisma.requisicao.findMany({
      where: { solicitanteId: funcionario.id },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
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
            item: { select: { nome: true, codigo: true, categoria: true } },
            movimentacoes: {
              where: { tipo: "SAIDA" },
              select: { quantidade: true },
            },
          },
        },
      },
    });
    const temMais = requisicoesComMais.length > PAGE_SIZE;
    const requisicoes = requisicoesComMais.slice(0, PAGE_SIZE);

    return NextResponse.json({
      requisicoes: requisicoes.map((requisicao) => ({
        numeroPedido: requisicao.numeroPedido,
        status: requisicao.status,
        criadoEm: requisicao.criadoEm.toISOString(),
        prioridade: requisicao.prioridade === "PRIORITARIO" ? "prioridade" : "padrao",
        itens: requisicao.itens.map((item) => ({
          nome: item.item.nome,
          codigo: item.item.codigo,
          categoria: item.item.categoria,
          quantidadePedida: item.quantidade,
          quantidadeSeparada: item.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0),
          unidadeMedida: item.unidadeMedida,
          descricao: decodeItemDescription(item.descricao).descricao,
          motivo: item.motivoNaoAtendido,
        })),
      })),
      pagina: page,
      limite: PAGE_SIZE,
      temMais,
      temAnterior: page > 1,
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
