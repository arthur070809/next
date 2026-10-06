import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma, StatusRequisicao, TipoMovimentacao } from "@/generated/prisma/client";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDepositOperationIdentity } from "@/lib/deposito-idempotency";
import { isSameOrigin } from "@/lib/security";
import { LOCAL_ESTOQUE_SLUG } from "@/lib/stock-locations";
import { MANUAL_DEPOSIT_REASONS, MAX_MANUAL_DEPOSIT_QUANTITY } from "@/lib/deposito-constants";

const DEPOSITO_SLUG = "deposito";
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return failure("Origem inválida.", 403);
  const authorization = await requireAlmoxarife();
  const { funcionario, status } = authorization;
  if (!funcionario) {
    return failure(status === 401 ? "Não autenticado." : "Acesso permitido apenas ao almoxarife ou admin.", status);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados da sobra em formato válido.", 400);
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const quantity = body.quantidade;
  const requisitionNumber = typeof body.requisicaoNumero === "string"
    ? body.requisicaoNumero.trim()
    : "";
  const reason = typeof body.motivo === "string" ? body.motivo.trim() : "";
  const observation = typeof body.observacao === "string" ? body.observacao.trim() : "";
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return failure("Chave de idempotência inválida ou ausente.", 400);
  }
  if (!itemId || typeof quantity !== "number" || !Number.isSafeInteger(quantity) ||
    quantity < 1 || quantity > MAX_MANUAL_DEPOSIT_QUANTITY) {
    return failure(`Informe item e quantidade inteira entre 1 e ${MAX_MANUAL_DEPOSIT_QUANTITY}.`, 400);
  }
  if (requisitionNumber && !/^[A-Za-z0-9-]{1,20}$/.test(requisitionNumber)) {
    return failure("Número da requisição inválido.", 400);
  }
  if (!requisitionNumber && !Object.values(MANUAL_DEPOSIT_REASONS).includes(reason as never)) {
    return failure("Selecione um motivo válido para registrar a sobra.", 400);
  }
  if (!requisitionNumber && reason === MANUAL_DEPOSIT_REASONS.OUTRO && !observation) {
    return failure("Descreva o motivo da sobra.", 400);
  }
  if (observation.length > 160) return failure("A observação deve ter até 160 caracteres.", 400);

  const operation = createDepositOperationIdentity(
    funcionario.id,
    idempotencyKey,
    "entrada",
    { itemId, quantity, requisitionNumber: requisitionNumber || null, reason, observation },
  );
  const sourceOperation = createDepositOperationIdentity(
    funcionario.id,
    idempotencyKey,
    "entrada-origem",
    { itemId, quantity, requisitionNumber: requisitionNumber || null, reason, observation },
  );
  const summary = requisitionNumber
    ? `Entrada de sobra da requisição ${requisitionNumber}.`
    : `Entrada de sobra: ${reason}${observation ? ` — ${observation}` : ""}.`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.movimentacao.findUnique({
        where: { id: operation.movementId },
        select: { id: true, observacao: true, quantidade: true, saldoApos: true },
      });
      if (previous) {
        if (previous.observacao?.includes(operation.marker)) {
          return { quantidade: previous.saldoApos, replayed: true };
        }
        throw Object.assign(new Error("A chave já foi usada para outra operação."), { code: "IDEMPOTENCY_CONFLICT" });
      }

      const item = await tx.item.findUnique({
        where: { id: itemId },
        select: { id: true, ativo: true },
      });
      if (!item?.ativo) throw Object.assign(new Error("Item não encontrado."), { code: "ITEM_NOT_FOUND" });

      let requisicao: { id: string; itemId: string; requisicaoItemId: string } | null = null;
      if (requisitionNumber) {
        const requestRow = await tx.requisicao.findUnique({
          where: { numeroPedido: requisitionNumber },
          select: {
            id: true,
            status: true,
            itens: { where: { itemId }, select: { id: true, itemId: true, quantidade: true } },
          },
        });
        if (!requestRow) throw Object.assign(new Error("Requisição não encontrada."), { code: "REQUEST_NOT_FOUND" });
        if (requestRow.status !== StatusRequisicao.CONCLUIDA) {
          throw Object.assign(new Error("A requisição ainda não foi concluída."), { code: "REQUEST_NOT_COMPLETED" });
        }
        const requestItem = requestRow.itens[0];
        if (!requestItem) throw Object.assign(new Error("A requisição não contém o item selecionado."), { code: "REQUEST_ITEM_MISMATCH" });
        const priorReturns = await tx.movimentacao.aggregate({
          where: {
            requisicaoItemId: requestItem.id,
            tipo: TipoMovimentacao.ENTRADA,
            saldoEstoque: { local: { slug: DEPOSITO_SLUG } },
          },
          _sum: { quantidade: true },
        });
        const alreadyReturned = priorReturns._sum.quantidade ?? 0;
        if (alreadyReturned + quantity > requestItem.quantidade) {
          throw Object.assign(new Error(`A devolução excede o restante de ${requestItem.quantidade - alreadyReturned} unidades.`), { code: "RETURN_EXCEEDS_REQUEST" });
        }
        requisicao = { id: requestRow.id, itemId: requestItem.itemId, requisicaoItemId: requestItem.id };
      }

      const deposito = await tx.localEstoque.upsert({
        where: { slug: DEPOSITO_SLUG },
        create: { slug: DEPOSITO_SLUG, nome: "Depósito de sobras", ativo: true },
        update: {},
      });
      const targetBalance = await tx.saldoEstoque.upsert({
        where: { itemId_localId: { itemId, localId: deposito.id } },
        create: { itemId, localId: deposito.id, quantidade: quantity, reservada: 0 },
        update: { quantidade: { increment: quantity } },
      });

      if (!requisicao) {
        const sourceLocation = await tx.localEstoque.findUnique({
          where: { slug: LOCAL_ESTOQUE_SLUG },
          select: { id: true },
        });
        if (!sourceLocation) throw Object.assign(new Error("Local de estoque principal não encontrado."), { code: "SOURCE_LOCATION_NOT_FOUND" });
        const sourceBalance = await tx.saldoEstoque.findUnique({
          where: { itemId_localId: { itemId, localId: sourceLocation.id } },
        });
        const available = (sourceBalance?.quantidade ?? 0) - (sourceBalance?.reservada ?? 0);
        if (!sourceBalance || available < quantity) {
          throw Object.assign(new Error(`Saldo livre insuficiente no estoque. Disponível: ${Math.max(available, 0)}.`), { code: "INSUFFICIENT_STOCK" });
        }
        const updated = await tx.saldoEstoque.updateMany({
          where: {
            id: sourceBalance.id,
            quantidade: sourceBalance.quantidade,
            reservada: sourceBalance.reservada,
          },
          data: { quantidade: sourceBalance.quantidade - quantity },
        });
        if (updated.count !== 1) {
          throw Object.assign(new Error("O saldo do estoque mudou. Atualize a tela e tente novamente."), { code: "STOCK_CHANGED" });
        }
        await tx.movimentacao.create({
          data: {
            id: sourceOperation.movementId,
            tipo: TipoMovimentacao.SAIDA,
            quantidade: quantity,
            saldoApos: sourceBalance.quantidade - quantity,
            reservadaApos: sourceBalance.reservada,
            funcionarioId: funcionario.id,
            saldoEstoqueId: sourceBalance.id,
            observacao: `Transferência para depósito de sobras. ${sourceOperation.marker}`,
          },
        });
      }

      await tx.movimentacao.create({
        data: {
          id: operation.movementId,
          tipo: TipoMovimentacao.ENTRADA,
          quantidade: quantity,
          saldoApos: targetBalance.quantidade,
          reservadaApos: targetBalance.reservada,
          funcionarioId: funcionario.id,
          saldoEstoqueId: targetBalance.id,
          requisicaoId: requisicao?.id,
          requisicaoItemId: requisicao?.requisicaoItemId,
          observacao: `${summary} ${operation.marker}`.slice(0, 500),
        },
      });
      return { quantidade: targetBalance.quantidade, replayed: false };
    });
    return NextResponse.json({
      message: result.replayed ? "Esta sobra já havia sido registrada." : "Sobra adicionada ao depósito.",
      deposito: { itemId, quantidade: result.quantidade },
      replayed: result.replayed,
    }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const knownStatus: Record<string, number> = {
      IDEMPOTENCY_CONFLICT: 409,
      ITEM_NOT_FOUND: 404,
      REQUEST_NOT_FOUND: 404,
      REQUEST_NOT_COMPLETED: 409,
      REQUEST_ITEM_MISMATCH: 400,
      RETURN_EXCEEDS_REQUEST: 409,
      SOURCE_LOCATION_NOT_FOUND: 500,
      INSUFFICIENT_STOCK: 409,
      STOCK_CHANGED: 409,
    };
    if (typeof code === "string" && knownStatus[code]) {
      return failure(error instanceof Error ? error.message : "Não foi possível registrar a sobra.", knownStatus[code]);
    }
    const errorId = randomUUID();
    console.error("Falha ao registrar sobra no depósito", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure("A operação foi processada simultaneamente; atualize os saldos antes de tentar novamente.", 409);
    }
    return NextResponse.json({ error: "Não foi possível registrar a sobra.", errorId }, { status: 500 });
  }
}
