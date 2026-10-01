import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { MANUAL_DEPOSIT_REASONS, MAX_MANUAL_DEPOSIT_QUANTITY } from "@/lib/deposito-constants";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

class EntradaManualError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

class EntradaConcorrenteError extends Error {}

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return responseError("Origem inválida.", 403);
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return responseError("Não autenticado.", 401);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return responseError("Atualize a tela e tente registrar novamente.", 400);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return responseError("Envie os dados da entrada em formato válido.", 400);
    }

    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    const quantidade = body.quantidade;
    const requisicaoNumero = body.requisicaoNumero === "" || body.requisicaoNumero === null || body.requisicaoNumero === undefined
      ? null
      : body.requisicaoNumero;
    const motivo = typeof body.motivo === "string" ? body.motivo : "";
    const observacao = typeof body.observacao === "string" ? body.observacao.trim() : "";

    if (!itemId) return responseError("Selecione um item do estoque.", 400);
    if (typeof quantidade !== "number" || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > MAX_MANUAL_DEPOSIT_QUANTITY) {
      return responseError(`Informe uma quantidade inteira entre 1 e ${MAX_MANUAL_DEPOSIT_QUANTITY.toLocaleString("pt-BR")} unidades.`, 400);
    }
    if (requisicaoNumero !== null && (typeof requisicaoNumero !== "number" || !Number.isSafeInteger(requisicaoNumero) || requisicaoNumero < 1)) {
      return responseError("Informe um número de requisição válido.", 400);
    }

    let motivoMovimentacao: string | null = null;
    if (requisicaoNumero === null) {
      const allowedReasons = Object.values(MANUAL_DEPOSIT_REASONS) as string[];
      if (!allowedReasons.includes(motivo)) return responseError("Selecione o motivo da entrada.", 400);
      if (motivo === MANUAL_DEPOSIT_REASONS.OUTRO && !observacao) {
        return responseError("Descreva o motivo da entrada.", 400);
      }
      if (observacao.length > 160) return responseError("A observação deve ter até 160 caracteres.", 400);
      motivoMovimentacao = motivo === MANUAL_DEPOSIT_REASONS.OUTRO ? `${motivo}: ${observacao}` : motivo;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (transaction) => {
          const previousMovement = await transaction.movimentacaoDeposito.findUnique({
            where: { idempotencyKey },
            select: { itemId: true, quantidade: true, requisicaoId: true, saldoAntes: true, saldoDepois: true, tipo: true },
          });
          if (previousMovement) {
            if (previousMovement.itemId !== itemId || previousMovement.quantidade !== quantidade || previousMovement.tipo !== "ENTRADA_MANUAL") {
              throw new EntradaManualError(409, "Esta chave já foi usada em outra entrada.");
            }
            return { duplicate: true, saldoAntes: previousMovement.saldoAntes, saldoDepois: previousMovement.saldoDepois, requisicaoId: previousMovement.requisicaoId };
          }

          const item = await transaction.estoqueItem.findUnique({
            where: { id: itemId },
            select: { id: true, nome: true, ativo: true, quantidade: true },
          });
          if (!item || !item.ativo) throw new EntradaManualError(400, "Item não encontrado ou inativo.");

          let requisicaoId: string | null = null;
          let estoqueDepois = item.quantidade;
          if (requisicaoNumero !== null) {
            const requisicao = await transaction.requisicao.findUnique({
              where: { numero: requisicaoNumero },
              select: { id: true, numero: true, item: true, estoqueItemId: true, quantidade: true, qtdDevolvida: true, status: true },
            });
            if (!requisicao) throw new EntradaManualError(400, `Requisição #${requisicaoNumero} não encontrada.`);
            if (requisicao.estoqueItemId !== item.id) throw new EntradaManualError(400, "O item selecionado não corresponde à requisição.");
            if (requisicao.status !== "RETIRADA") throw new EntradaManualError(400, "A requisição ainda não foi retirada ou foi cancelada.");
            const restante = requisicao.quantidade - requisicao.qtdDevolvida;
            if (quantidade > restante) throw new EntradaManualError(400, `Só é possível devolver até ${restante} unidades desta requisição.`);

            const updated = await transaction.requisicao.updateMany({
              where: {
                id: requisicao.id,
                status: "RETIRADA",
                qtdDevolvida: { equals: requisicao.qtdDevolvida },
                quantidade: { gte: requisicao.qtdDevolvida + quantidade },
              },
              data: { qtdDevolvida: { increment: quantidade } },
            });
            if (updated.count !== 1) throw new EntradaConcorrenteError();
            requisicaoId = requisicao.id;
          } else {
            const retirada = await transaction.estoqueItem.updateMany({
              where: { id: item.id, ativo: true, quantidade: { gte: quantidade } },
              data: { quantidade: { decrement: quantidade } },
            });
            if (retirada.count !== 1) {
              const saldoAtual = await transaction.estoqueItem.findUnique({ where: { id: item.id }, select: { quantidade: true } });
              throw new EntradaManualError(409, `Saldo insuficiente no estoque. Disponível: ${saldoAtual?.quantidade ?? 0}.`);
            }
            const saldoAtual = await transaction.estoqueItem.findUnique({ where: { id: item.id }, select: { quantidade: true } });
            estoqueDepois = saldoAtual?.quantidade ?? Math.max(0, item.quantidade - quantidade);
          }

          const saldoAnterior = await transaction.saldoDeposito.findUnique({
            where: { itemId: item.id },
            select: { quantidade: true },
          });
          const saldoAntes = saldoAnterior?.quantidade ?? 0;
          await transaction.saldoDeposito.upsert({
            where: { itemId: item.id },
            create: { itemId: item.id, quantidade },
            update: { quantidade: { increment: quantidade } },
          });
          const saldoAtual = await transaction.saldoDeposito.findUnique({
            where: { itemId: item.id },
            select: { quantidade: true },
          });
          if (!saldoAtual) throw new Error("Saldo do depósito não foi encontrado após a entrada.");

          await transaction.movimentacaoDeposito.create({
            data: {
              itemId: item.id,
              tipo: "ENTRADA_MANUAL",
              quantidade,
              saldoAntes,
              saldoDepois: saldoAtual.quantidade,
              requisicaoId,
              usuarioId: funcionario.id,
              motivo: motivoMovimentacao,
              idempotencyKey,
            },
          });
          return { duplicate: false, saldoAntes, saldoDepois: saldoAtual.quantidade, estoqueAntes: item.quantidade, estoqueDepois, requisicaoId };
        }, { isolationLevel: "Serializable" });

        const message = result.duplicate
          ? `Esta entrada já havia sido registrada. Saldo do depósito ${result.saldoDepois}.`
          : result.requisicaoId
            ? `Sobra registrada: +${quantidade} unidades da requisição. Estoque sem alteração; saldo do depósito ${result.saldoDepois}.`
            : `${quantidade} unidades movidas do estoque para o depósito. Estoque ${result.estoqueDepois}; depósito ${result.saldoDepois}.`;
        return NextResponse.json({ ...result, message }, { status: result.duplicate ? 200 : 201 });
      } catch (error) {
        if (error instanceof EntradaManualError) return responseError(error.message, error.status);
        if (error instanceof EntradaConcorrenteError) {
          if (attempt < 2) continue;
          return responseError("A requisição foi alterada. Atualize e tente novamente.", 409);
        }
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
        if (code === "P2034" || code === "P2002") return responseError("O saldo mudou durante a entrada. Atualize e tente novamente.", 409);
        throw error;
      }
    }
    return responseError("O saldo mudou durante a entrada. Atualize e tente novamente.", 409);
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao adicionar sobra ao depósito", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Não foi possível adicionar a sobra ao depósito.", errorId }, { status: 500 });
  }
}