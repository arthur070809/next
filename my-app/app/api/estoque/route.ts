import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { MAX_STOCK_BALANCE, MAX_STOCK_INPUT, STOCK_UNITS } from "@/lib/stock-units";
import { TipoMovimentacao } from "@/generated/prisma/client";

// Slug do local padrão "estoque central"
const LOCAL_ESTOQUE_SLUG = "estoque";
const LOCAL_DEPOSITO_SLUG = "deposito";

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

/** Garante que o local existe; cria se não existir (idempotente) */
async function ensureLocal(slug: string, nome: string) {
  return prisma.localEstoque.upsert({
    where: { slug },
    create: { slug, nome, ativo: true },
    update: {},
  });
}

/** Formata item + saldo para a resposta da API (retrocompatível com o front) */
function formatItem(item: {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  tipoUnidade: string;
  quantidadePorEmbalagem: number;
  tipoItem: string;
  codigo: string | null;
  filial: string | null;
  grupoErp: string | null;
  pontoPedido: number;
  estoqueSeguranca: number;
  bloqueadoCompra: boolean;
  ultimaEntradaEmbalagens: number | null;
  ativo: boolean;
  saldos: Array<{ quantidade: number; reservada: number; local: { slug: string } }>;
}) {
  const saldoEstoque = item.saldos.find((s) => s.local.slug === LOCAL_ESTOQUE_SLUG);
  const saldoDeposito = item.saldos.find((s) => s.local.slug === LOCAL_DEPOSITO_SLUG);
  return {
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    unidade: item.unidade,
    tipoUnidade: item.tipoUnidade,
    quantidadePorEmbalagem: item.quantidadePorEmbalagem,
    tipoItem: item.tipoItem,
    codigo: item.codigo,
    filial: item.filial,
    grupoErp: item.grupoErp,
    pontoPedido: item.pontoPedido,
    estoqueSeguranca: item.estoqueSeguranca,
    bloqueadoCompra: item.bloqueadoCompra,
    ultimaEntradaEmbalagens: item.ultimaEntradaEmbalagens,
    ativo: item.ativo,
    // Campos retrocompatíveis com o front (era EstoqueItem.quantidade)
    quantidade: saldoEstoque?.quantidade ?? 0,
    reservada: saldoEstoque?.reservada ?? 0,
    disponivel: (saldoEstoque?.quantidade ?? 0) - (saldoEstoque?.reservada ?? 0),
    quantidadeDeposito: saldoDeposito?.quantidade ?? 0,
  };
}

export async function GET() {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return respostaJson({ error: "Não autenticado." }, { status: 401 });

    const itens = await prisma.item.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      include: {
        saldos: {
          include: { local: { select: { slug: true } } },
        },
      },
    });

    return respostaJson({ itens: itens.map(formatItem) });
  } catch (error) {
    return respostaErroInterno(error, "carregar");
  }
}

export async function POST(request: Request) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return respostaJson({ error: "Não autenticado." }, { status: 401 });
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

    if (!nome || !categoria) {
      return respostaJson({ error: "Informe o nome do material e a categoria." }, { status: 400 });
    }
    if (!tipoUnidade) {
      return respostaJson({ error: "Selecione o tipo de unidade." }, { status: 400 });
    }

    const limite = MAX_STOCK_INPUT.toLocaleString("pt-BR");
    if (tipoUnidade.value !== "unidade" && (!Number.isInteger(quantidadePorEmbalagem) || quantidadePorEmbalagem < 1 || quantidadePorEmbalagem > MAX_STOCK_INPUT)) {
      return respostaJson({
        error: `Informe a quantidade por ${tipoUnidade.singular} como inteiro positivo (máximo: ${limite}).`,
        field: "quantidadePorEmbalagem",
      }, { status: 400 });
    }
    if (!Number.isInteger(quantidadeEmbalagens) || quantidadeEmbalagens < 1 || quantidadeEmbalagens > MAX_STOCK_INPUT) {
      return respostaJson({
        error: `Informe a quantidade de ${tipoUnidade.countLabel} como inteiro positivo (máximo: ${limite}).`,
        field: "quantidadeEmbalagens",
      }, { status: 400 });
    }

    const quantidade = quantidadeEmbalagens * quantidadePorEmbalagem;
    if (!Number.isSafeInteger(quantidade) || quantidade > MAX_STOCK_BALANCE) {
      return respostaJson({ error: "O saldo calculado excede o limite permitido para o estoque." }, { status: 400 });
    }

    let item;
    for (let attempt = 0; ; attempt += 1) {
      try {
        item = await prisma.$transaction(async (tx) => {
          // Garante que o local "estoque" existe
          const local = await tx.localEstoque.upsert({
            where: { slug: LOCAL_ESTOQUE_SLUG },
            create: { slug: LOCAL_ESTOQUE_SLUG, nome: "Estoque Central", ativo: true },
            update: {},
          });

          const itemExistente = await tx.item.findFirst({
            where: { nome, categoria, ativo: true },
          });

          const detalhesEntrada = {
            tipoUnidade: tipoUnidade.value,
            quantidadePorEmbalagem,
            ultimaEntradaEmbalagens: quantidadeEmbalagens,
          };

          let itemResult;
          if (itemExistente) {
            itemResult = itemExistente;
            // Atualiza metadados do item
            await tx.item.update({
              where: { id: itemExistente.id },
              data: detalhesEntrada,
            });
          } else {
            itemResult = await tx.item.create({
              data: {
                nome,
                categoria,
                unidade: tipoUnidade.baseUnit,
                ...detalhesEntrada,
              },
            });
          }

          // Upsert do saldo — incremento atômico para evitar conflito concorrente
          const saldoExistente = await tx.saldoEstoque.findUnique({
            where: { itemId_localId: { itemId: itemResult.id, localId: local.id } },
          });

          let novoSaldo: number;
          if (saldoExistente) {
            const updated = await tx.saldoEstoque.update({
              where: { id: saldoExistente.id },
              data: { quantidade: { increment: quantidade } },
            });
            novoSaldo = updated.quantidade;
          } else {
            const created = await tx.saldoEstoque.create({
              data: { itemId: itemResult.id, localId: local.id, quantidade, reservada: 0 },
            });
            novoSaldo = created.quantidade;
          }

          // Registra movimentação de ENTRADA (append-only)
          const saldoId = saldoExistente?.id ?? (
            await tx.saldoEstoque.findUnique({
              where: { itemId_localId: { itemId: itemResult.id, localId: local.id } },
              select: { id: true },
            })
          )?.id;

          if (saldoId) {
            await tx.movimentacao.create({
              data: {
                tipo: TipoMovimentacao.ENTRADA,
                quantidade,
                saldoApos: novoSaldo,
                reservadaApos: saldoExistente?.reservada ?? 0,
                funcionarioId: funcionario.id,
                saldoEstoqueId: saldoId,
                observacao: `Entrada de ${quantidadeEmbalagens} ${tipoUnidade.countLabel}`,
              },
            });
          }

          return tx.item.findUnique({
            where: { id: itemResult.id },
            include: {
              saldos: { include: { local: { select: { slug: true } } } },
            },
          });
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        const serializationConflict = typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
        if (!serializationConflict || attempt >= 2) throw error;
      }
    }

    return respostaJson({ item: item ? formatItem(item) : null }, { status: 201 });
  } catch (error) {
    return respostaErroInterno(error, "cadastrar");
  }
}

export async function PATCH(request: Request) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return respostaJson({ error: "Não autenticado." }, { status: 401 });
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

    // Ajuste de saldo — registra movimentação de AJUSTE
    const item = await prisma.$transaction(async (tx) => {
      const local = await tx.localEstoque.findUnique({ where: { slug: LOCAL_ESTOQUE_SLUG } });
      if (!local) throw new Error("Local de estoque não encontrado.");

      const saldo = await tx.saldoEstoque.findUnique({
        where: { itemId_localId: { itemId: id, localId: local.id } },
      });

      const saldoAnterior = saldo?.quantidade ?? 0;
      const diff = quantidade - saldoAnterior;

      const saldoResult = saldo
        ? await tx.saldoEstoque.update({
            where: { id: saldo.id },
            data: { quantidade },
          })
        : await tx.saldoEstoque.create({
            data: { itemId: id, localId: local.id, quantidade, reservada: 0 },
          });

      // Registra movimentação de ajuste
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.AJUSTE,
          quantidade: Math.abs(diff),
          saldoApos: saldoResult.quantidade,
          reservadaApos: saldoResult.reservada,
          funcionarioId: funcionario.id,
          saldoEstoqueId: saldoResult.id,
          observacao: `Ajuste manual: ${saldoAnterior} → ${quantidade}`,
        },
      });

      return tx.item.findUnique({
        where: { id },
        include: { saldos: { include: { local: { select: { slug: true } } } } },
      });
    });

    if (!item) return respostaJson({ error: "Item não encontrado." }, { status: 404 });
    return respostaJson({ item: formatItem(item) });
  } catch (error) {
    return respostaErroInterno(error, "atualizar");
  }
}

// Exporta helpers para uso em outros módulos
export { ensureLocal, LOCAL_ESTOQUE_SLUG, LOCAL_DEPOSITO_SLUG };