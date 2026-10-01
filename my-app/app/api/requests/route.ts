import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

type RequestLine = {
  itemId: string;
  quantidade: number;
  descricao?: string;
  setor?: string;
  unidadeMedida?: string;
  prioridade?: string;
};

class InsufficientStockError extends Error {
  constructor(readonly available: number, readonly itemName: string) {
    super("Saldo insuficiente no estoque.");
  }
}

class AllocationConflictError extends Error {}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return errorResponse("Não autenticado.", 401);
    const numero = new URL(request.url).searchParams.get("numero");
    if (numero !== null) {
      const parsedNumero = Number(numero);
      if (!Number.isSafeInteger(parsedNumero) || parsedNumero < 1) return errorResponse("Informe um número de requisição válido.", 400);
      const requisicao = await prisma.requisicao.findUnique({
        where: { numero: parsedNumero },
        select: { id: true, numero: true, item: true, estoqueItemId: true, quantidade: true, qtdDevolvida: true, status: true },
      });
      if (!requisicao) return errorResponse(`Requisição #${parsedNumero} não encontrada no Prisma.`, 404);
      return NextResponse.json({ requisicao });
    }
    const requisicoes = await prisma.requisicao.findMany({
      where: { status: "RETIRADA" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        funcionario: { select: { nome: true } },
        estoqueItem: { select: { codigo: true } },
      },
    });
    return NextResponse.json({ requisicoes });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao listar requisições", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar as requisições.", errorId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return errorResponse("Não autenticado.", 401);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return errorResponse("Não foi possível identificar esta requisição. Atualize a página e tente novamente.", 400);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Envie os dados da requisição em um formato válido.", 400);
    }
    const rawLines = Array.isArray(body.itens) ? body.itens : [];
    if (rawLines.length < 1 || rawLines.length > 50) return errorResponse("Adicione ao menos um item à requisição.", 400);

    const lines: RequestLine[] = [];
    for (const rawLine of rawLines) {
      if (!rawLine || typeof rawLine !== "object") return errorResponse("Há um item inválido na requisição.", 400);
      const line = rawLine as Record<string, unknown>;
      const itemId = typeof line.itemId === "string" ? line.itemId.trim() : "";
      const quantidade = line.quantidade;
      if (!itemId || typeof quantidade !== "number" || !Number.isSafeInteger(quantidade) || quantidade < 1) {
        return errorResponse("Informe um item e uma quantidade inteira maior que zero.", 400);
      }
      lines.push({
        itemId,
        quantidade,
        descricao: typeof line.descricao === "string" ? line.descricao.trim().slice(0, 2000) : undefined,
        setor: typeof line.setor === "string" ? line.setor.slice(0, 30) : undefined,
        unidadeMedida: typeof line.unidadeMedida === "string" ? line.unidadeMedida.slice(0, 10) : undefined,
        prioridade: line.prioridade === "prioridade" ? "prioridade" : "padrao",
      });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const requisicoes = await prisma.$transaction(async (transaction) => {
          const existentes = await transaction.requisicao.findMany({ where: { grupoIdempotencia: idempotencyKey } });
          if (existentes.length > 0) {
            if (existentes.length !== lines.length) throw new AllocationConflictError();
            return existentes;
          }

          const criadas = [];
          for (const [index, line] of lines.entries()) {
            const item = await transaction.estoqueItem.findUnique({ where: { id: line.itemId } });
            if (!item || !item.ativo) throw new InsufficientStockError(0, "Item não disponível.");

            const saldoDeposito = await transaction.saldoDeposito.findUnique({
              where: { itemId: item.id },
              select: { quantidade: true },
            });
            const quantidadeDeposito = saldoDeposito?.quantidade ?? 0;
            const origem = quantidadeDeposito >= line.quantidade ? "DEPOSITO" : "ESTOQUE";

            if (origem === "DEPOSITO") {
              const retirada = await transaction.saldoDeposito.updateMany({
                where: { itemId: item.id, quantidade: { gte: line.quantidade, equals: quantidadeDeposito } },
                data: { quantidade: { decrement: line.quantidade } },
              });
              if (retirada.count !== 1) throw new AllocationConflictError();
            } else {
              const retirada = await transaction.estoqueItem.updateMany({
                where: { id: item.id, ativo: true, quantidade: { gte: line.quantidade, equals: item.quantidade } },
                data: { quantidade: { decrement: line.quantidade } },
              });
              if (retirada.count !== 1) {
                const saldoAtual = await transaction.estoqueItem.findUnique({ where: { id: item.id }, select: { quantidade: true } });
                throw new InsufficientStockError(saldoAtual?.quantidade ?? 0, item.nome);
              }
            }

            const requisicao = await transaction.requisicao.create({
              data: {
                item: item.nome,
                estoqueItemId: item.id,
                quantidade: line.quantidade,
                observacao: line.descricao || null,
                setor: line.setor || null,
                unidadeMedida: line.unidadeMedida || null,
                prioridade: line.prioridade,
                status: "RETIRADA",
                origem,
                origemLegada: origem,
                idempotencyKey: `${idempotencyKey}:${index}`,
                grupoIdempotencia: idempotencyKey,
                funcionarioId: funcionario.id,
              },
            });

            if (origem === "DEPOSITO") {
              await transaction.movimentacaoDeposito.create({
                data: {
                  itemId: item.id,
                  tipo: "SAIDA_REQUISICAO",
                  quantidade: line.quantidade,
                  saldoAntes: quantidadeDeposito,
                  saldoDepois: quantidadeDeposito - line.quantidade,
                  requisicaoId: requisicao.id,
                  usuarioId: funcionario.id,
                },
              });
            }
            criadas.push({ ...requisicao, saldoDeposito: origem === "DEPOSITO" ? quantidadeDeposito - line.quantidade : quantidadeDeposito });
          }
          return criadas;
        }, { isolationLevel: "Serializable" });

        return NextResponse.json({ requisicoes }, { status: 201 });
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          const message = error.itemName === "Item não disponível."
            ? error.itemName
            : `Saldo insuficiente no estoque. Disponível: ${error.available}.`;
          return errorResponse(message, 409);
        }
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if ((error instanceof AllocationConflictError || code === "P2034") && attempt < 2) continue;
        if (error instanceof AllocationConflictError || code === "P2034") {
          return errorResponse("O saldo mudou durante a requisição. Atualize e tente novamente.", 409);
        }
        if (code === "P2002") {
          const existentes = await prisma.requisicao.findMany({ where: { grupoIdempotencia: idempotencyKey } }).catch(() => []);
          if (existentes.length === lines.length) return NextResponse.json({ requisicoes: existentes });
          return errorResponse("Esta requisição já foi registrada. Atualize a lista.", 409);
        }
        throw error;
      }
    }
    return errorResponse("O saldo mudou durante a requisição. Atualize e tente novamente.", 409);
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao criar requisição", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível registrar a requisição.", errorId }, { status: 500 });
  }
}