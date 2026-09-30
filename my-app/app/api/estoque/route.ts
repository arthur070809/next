import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { MAX_STOCK_BALANCE, MAX_STOCK_INPUT, STOCK_UNITS } from "@/lib/stock-units";

function respostaJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return NextResponse.json(body, { ...init, headers });
}

function respostaErroInterno(error: unknown, operacao: string) {
  const errorId = randomUUID();
  const errorRecord = typeof error === "object" && error !== null ? error : null;
  const prismaCode = errorRecord && "code" in errorRecord && typeof errorRecord.code === "string" ? errorRecord.code : undefined;
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const stack = error instanceof Error ? error.stack?.split("\n").slice(1).join("\n") : undefined;
  const status = prismaCode === "P2002" || prismaCode === "P2034" ? 409 : prismaCode === "P2025" ? 404 : 500;
  const message = status === 409
    ? prismaCode === "P2002"
      ? "Este item já existe. Atualize a lista e tente novamente."
      : "O estoque foi alterado por outra operação. Atualize e tente novamente."
    : status === 404
      ? "Item não encontrado."
      : operacao === "carregar"
        ? "Não foi possível carregar o estoque. Tente novamente."
        : operacao === "atualizar"
          ? "Não foi possível atualizar o estoque. Tente novamente."
          : "Não foi possível cadastrar o item. Tente novamente.";

  console.error("Erro interno na API de estoque", { errorId, operacao, errorName, prismaCode, stack });
  return respostaJson({ error: message, errorId }, { status });
}

export async function GET() {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    const itens = await prisma.estoqueItem.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    });

    return respostaJson({ itens });
  } catch (error) {
    return respostaErroInterno(error, "carregar");
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    if (!isSameOrigin(request)) return respostaJson({ error: "Origem inválida." }, { status: 403 });
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return respostaJson({ error: "Envie os dados do item em um formato válido." }, { status: 400 });
    }
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const categoria = typeof body?.categoria === "string" ? body.categoria.trim() : "";
    const tipoUnidade = STOCK_UNITS.find((unit) => unit.value === body?.tipoUnidade);
    const quantidadeEmbalagens = typeof body?.quantidadeEmbalagens === "number" ? body.quantidadeEmbalagens : Number.NaN;
    const quantidadePorEmbalagem = tipoUnidade?.value === "unidade"
      ? 1
      : typeof body?.quantidadePorEmbalagem === "number"
        ? body.quantidadePorEmbalagem
        : Number.NaN;

    if (
      !nome ||
      !categoria ||
      !tipoUnidade ||
      !Number.isInteger(quantidadeEmbalagens) ||
      quantidadeEmbalagens < 1 ||
      quantidadeEmbalagens > MAX_STOCK_INPUT ||
      !Number.isInteger(quantidadePorEmbalagem) ||
      quantidadePorEmbalagem < 1 ||
      quantidadePorEmbalagem > MAX_STOCK_INPUT
    ) {
      return respostaJson(
        { error: `Use quantidades inteiras positivas, de até ${MAX_STOCK_INPUT.toLocaleString("pt-BR")} por campo.` },
        { status: 400 }
      );
    }

    const quantidade = quantidadeEmbalagens * quantidadePorEmbalagem;
    if (!Number.isSafeInteger(quantidade) || quantidade > MAX_STOCK_BALANCE) {
      return respostaJson({ error: "O saldo calculado excede o limite permitido para o estoque." }, { status: 400 });
    }

    let item;
    for (let attempt = 0; ; attempt += 1) {
      try {
        item = await prisma.$transaction(async (transaction) => {
          const itemExistente = await transaction.estoqueItem.findFirst({
            where: { nome, categoria, ativo: true },
          });
          const detalhesEntrada = {
            tipoUnidade: tipoUnidade.value,
            quantidadePorEmbalagem,
            ultimaEntradaEmbalagens: quantidadeEmbalagens,
          };

          return itemExistente
            ? transaction.estoqueItem.update({
              where: { id: itemExistente.id },
              data: { ...detalhesEntrada, quantidade: { increment: quantidade } },
            })
            : transaction.estoqueItem.create({
              data: { nome, categoria, unidade: tipoUnidade.baseUnit, quantidade, ...detalhesEntrada },
            });
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        const serializationConflict = typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
        if (!serializationConflict || attempt >= 2) throw error;
      }
    }

    return respostaJson({ item }, { status: 201 });
  } catch (error) {
    return respostaErroInterno(error, "cadastrar");
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    if (!isSameOrigin(request)) return respostaJson({ error: "Origem inválida." }, { status: 403 });
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return respostaJson({ error: "Envie os dados do item em um formato válido." }, { status: 400 });
    }
    const id = typeof body?.id === "string" ? body.id : "";
    const quantidade = Number(body?.quantidade);

    if (!id || !Number.isInteger(quantidade) || quantidade < 0) {
      return respostaJson({ error: "Item ou quantidade inválida." }, { status: 400 });
    }

    const item = await prisma.estoqueItem.update({
      where: { id },
      data: { quantidade },
    });

    return respostaJson({ item });
  } catch (error) {
    return respostaErroInterno(error, "atualizar");
  }
}