import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { criarRequisicao, toRequisicaoMock } from "@/lib/requisicoes-db";
import { LOCAL_ESTOQUE_SLUG } from "../estoque/route";
import { PapelFuncionario } from "@/generated/prisma/client";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const isStaff =
      funcionario.papel === PapelFuncionario.ADMIN ||
      funcionario.papel === PapelFuncionario.ALMOXARIFE;

    const requisicoesRaw = await prisma.requisicao.findMany({
      where: isStaff ? {} : { solicitanteId: funcionario.id },
      include: {
        solicitante: { select: { nome: true, cracha: true } },
        atendente: { select: { nome: true, cracha: true } },
        itens: {
          include: {
            item: { select: { nome: true } },
            local: { select: { slug: true } },
          },
        },
      },
      orderBy: { criadoEm: "desc" },
      take: 100,
    });

    const requisicoes = requisicoesRaw.map(toRequisicaoMock);
    return NextResponse.json({ requisicoes });
  } catch (error) {
    console.error("Erro ao listar requisições:", error instanceof Error ? error.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível carregar as requisições." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }

    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();

    // Garante que o local estoque central existe
    const localEstoque = await prisma.localEstoque.upsert({
      where: { slug: LOCAL_ESTOQUE_SLUG },
      create: { slug: LOCAL_ESTOQUE_SLUG, nome: "Estoque Central", ativo: true },
      update: {},
    });

    const itemsToProcess: Array<{
      itemId: string;
      localId: string;
      quantidade: number;
      unidadeMedida?: string;
      descricao?: string;
    }> = [];

    let prioridade: "padrao" | "prioridade" = "padrao";
    let observacao: string | undefined;

    // Caso 1: Array de itens (enviado por RequisicaoPage)
    if (Array.isArray(body?.itens) && body.itens.length > 0) {
      for (const rawItem of body.itens) {
        const itemNome = typeof rawItem?.itemNome === "string" ? rawItem.itemNome.trim() : "";
        const itemId = typeof rawItem?.itemId === "string" ? rawItem.itemId : undefined;
        const quantidade = Number(rawItem?.quantidade);

        if ((!itemNome && !itemId) || !Number.isInteger(quantidade) || quantidade < 1) {
          return NextResponse.json(
            { error: "Cada item deve ter nome válido e quantidade inteira positiva." },
            { status: 400 }
          );
        }

        // Busca item no catálogo
        const dbItem = itemId
          ? await prisma.item.findUnique({ where: { id: itemId, ativo: true } })
          : await prisma.item.findFirst({ where: { nome: itemNome, ativo: true } });

        if (!dbItem) {
          return NextResponse.json(
            { error: `Item "${itemNome || itemId}" não encontrado no catálogo de materiais.` },
            { status: 404 }
          );
        }

        if (rawItem.prioridade === "prioridade") {
          prioridade = "prioridade";
        }

        itemsToProcess.push({
          itemId: dbItem.id,
          localId: localEstoque.id,
          quantidade,
          unidadeMedida: typeof rawItem?.unidadeMedida === "string" ? rawItem.unidadeMedida : "UN",
          descricao: typeof rawItem?.descricao === "string" ? rawItem.descricao.trim() : undefined,
        });
      }
    }
    // Caso 2: Objeto simples (legado ou teste)
    else if (body?.item) {
      const itemNome = typeof body.item === "string" ? body.item.trim() : "";
      const quantidade = Number(body.quantidade);
      observacao = typeof body.observacao === "string" ? body.observacao.trim() : undefined;

      if (!itemNome || !Number.isInteger(quantidade) || quantidade < 1) {
        return NextResponse.json(
          { error: "Informe um item e uma quantidade inteira maior que zero." },
          { status: 400 }
        );
      }

      const dbItem = await prisma.item.findFirst({
        where: { nome: itemNome, ativo: true },
      });

      if (!dbItem) {
        return NextResponse.json(
          { error: `Item "${itemNome}" não encontrado no catálogo.` },
          { status: 404 }
        );
      }

      itemsToProcess.push({
        itemId: dbItem.id,
        localId: localEstoque.id,
        quantidade,
        unidadeMedida: dbItem.unidade || "UN",
        descricao: observacao,
      });
    } else {
      return NextResponse.json(
        { error: "Nenhum item informado para a requisição." },
        { status: 400 }
      );
    }

    // Cria requisição com reserva atômica de estoque em transação
    try {
      const requisicao = await criarRequisicao({
        solicitanteId: funcionario.id,
        itens: itemsToProcess,
        prioridade,
        observacao,
      });

      return NextResponse.json(
        {
          numeroPedido: requisicao.numeroPedido,
          requisicao: toRequisicaoMock(requisicao),
        },
        { status: 201 }
      );
    } catch (reservaError: unknown) {
      const err = reservaError as { code?: string; message?: string; disponivel?: number };
      if (err?.code === "SALDO_INSUFICIENTE") {
        return NextResponse.json(
          {
            error: err.message || "Saldo disponível insuficiente para atender a requisição.",
            code: "SALDO_INSUFICIENTE",
            disponivel: err.disponivel,
          },
          { status: 409 }
        );
      }
      throw reservaError;
    }
  } catch (error) {
    console.error("Erro ao criar requisição:", error instanceof Error ? error.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível criar a requisição." },
      { status: 500 }
    );
  }
}
