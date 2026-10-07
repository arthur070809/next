import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { criarRequisicaoIdempotente, toRequisicaoMock } from "@/lib/requisicoes-db";
import { encodeItemDescription, type SetorRequisicao } from "@/lib/requisition-metadata";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH_ERROR,
  normalizeRequisitionDescription,
} from "@/lib/requisition-description";
import { LOCAL_ESTOQUE_SLUG } from "@/lib/stock-locations";
import { PapelFuncionario, StatusRequisicao, TipoMovimentacao } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const requestNumber = params.get("numero")?.trim() ?? "";
    if (requestNumber) {
      const isStaff =
        funcionario.papel === PapelFuncionario.ADMIN ||
        funcionario.papel === PapelFuncionario.ALMOXARIFE;
      if (!isStaff) return NextResponse.json({ error: "Acesso permitido apenas ao almoxarife ou admin." }, { status: 403 });
      const itemId = params.get("itemId")?.trim() ?? "";
      if (!itemId) return NextResponse.json({ error: "Selecione o item para verificar a devolução." }, { status: 400 });
      const requisicao = await prisma.requisicao.findUnique({
        where: { numeroPedido: requestNumber },
        select: {
          id: true,
          numeroPedido: true,
          status: true,
          itens: {
            where: { itemId },
            select: { id: true, itemId: true, quantidade: true, item: { select: { nome: true } } },
          },
        },
      });
      if (!requisicao) return NextResponse.json({ error: "Requisição não encontrada." }, { status: 404 });
      const item = requisicao.itens[0];
      if (!item) return NextResponse.json({ error: "A requisição não contém o item selecionado." }, { status: 404 });
      const devolucoes = await prisma.movimentacao.aggregate({
        where: {
          requisicaoItemId: item.id,
          tipo: TipoMovimentacao.ENTRADA,
          saldoEstoque: { local: { slug: "deposito" } },
        },
        _sum: { quantidade: true },
      });
      return NextResponse.json({
        requisicao: {
          id: requisicao.id,
          numero: requisicao.numeroPedido,
          item: item.item.nome,
          estoqueItemId: item.itemId,
          quantidade: item.quantidade,
          qtdDevolvida: devolucoes._sum.quantidade ?? 0,
          status: requisicao.status === StatusRequisicao.CONCLUIDA ? "RETIRADA" : requisicao.status,
        },
      });
    }

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
    if (funcionario.papel !== PapelFuncionario.OPERADOR) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const descriptions: unknown[] = Array.isArray(body?.itens)
      ? body.itens.map((item: { descricao?: unknown }) => item?.descricao)
      : [body?.observacao];
    if (descriptions.some((value) =>
      typeof value === "string" &&
      Array.from(normalizeRequisitionDescription(value)).length > DESCRIPTION_MAX_LENGTH
    )) {
      return NextResponse.json(
        { error: DESCRIPTION_MAX_LENGTH_ERROR },
        { status: 400 },
      );
    }
    const rawIdempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawIdempotencyKey)) {
      return NextResponse.json({ error: "Chave de idempotência inválida ou ausente." }, { status: 400 });
    }

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
      setor?: SetorRequisicao;
    }> = [];

    let prioridade: "padrao" | "prioridade" = "padrao";
    let observacao: string | undefined;

    // Caso 1: Array de itens (enviado por RequisicaoPage)
    if (Array.isArray(body?.itens) && body.itens.length > 0) {
      for (const rawItem of body.itens) {
        const itemNome = typeof rawItem?.itemNome === "string" ? rawItem.itemNome.trim() : "";
        const itemId = typeof rawItem?.itemId === "string" ? rawItem.itemId : undefined;
        const quantidade = Number(rawItem?.quantidade);
        const setor = rawItem?.setor;
        const descricao = typeof rawItem?.descricao === "string"
          ? normalizeRequisitionDescription(rawItem.descricao)
          : "";

        if (
          (!itemNome && !itemId) ||
          !Number.isInteger(quantidade) ||
          quantidade < 1 ||
          !["setor1", "setor2", "setor3"].includes(setor) ||
          (rawItem.prioridade === "prioridade" && !descricao)
        ) {
          return NextResponse.json(
            { error: rawItem.prioridade === "prioridade" && !descricao
              ? "Pedidos prioritários exigem uma descrição ou justificativa."
              : "Cada item deve ter nome, setor válido e quantidade inteira positiva." },
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
          descricao: encodeItemDescription(
            descricao || undefined,
            setor as SetorRequisicao,
          ) ?? undefined,
          setor: setor as SetorRequisicao,
        });
      }
    }
    // Caso 2: Objeto simples (legado ou teste)
    else if (body?.item) {
      const itemNome = typeof body.item === "string" ? body.item.trim() : "";
      const quantidade = Number(body.quantidade);
      observacao = typeof body.observacao === "string"
        ? normalizeRequisitionDescription(body.observacao)
        : undefined;

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
      const keyHash = createHash("sha256")
        .update(`${funcionario.id}:${rawIdempotencyKey}`)
        .digest("hex");
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({
          itens: itemsToProcess,
          prioridade,
          observacao: observacao ?? null,
        }))
        .digest("hex");
      const { requisicao, replayed } = await criarRequisicaoIdempotente({
        solicitanteId: funcionario.id,
        itens: itemsToProcess,
        prioridade,
        observacao,
        idempotencyKeyHash: keyHash,
        payloadHash,
      });

      return NextResponse.json(
        {
          numeroPedido: requisicao.numeroPedido,
          requisicao: toRequisicaoMock(requisicao),
          replayed,
        },
        { status: replayed ? 200 : 201 }
      );
    } catch (reservaError: unknown) {
      const err = reservaError as { code?: string; message?: string; disponivel?: number };
      if (err?.code === "IDEMPOTENCY_CONFLICT") {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
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
