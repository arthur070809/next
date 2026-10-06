import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma, TipoMovimentacao } from "@/generated/prisma/client";
import { requireAlmoxarife } from "@/lib/auth";
import { createDepositOperationIdentity } from "@/lib/deposito-idempotency";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const DEPOSITO_SLUG = "deposito";
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const { funcionario, status } = await requireAlmoxarife();
  if (!funcionario) {
    return NextResponse.json({
      error: status === 401 ? "Não autenticado." : "Acesso permitido apenas ao almoxarife ou admin.",
    }, { status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie os dados da retirada em formato válido." }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const quantity = body.quantidade;
  const reason = typeof body.motivo === "string" ? body.motivo.trim() : "";
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return NextResponse.json({ error: "Chave de idempotência inválida ou ausente." }, { status: 400 });
  }
  if (!itemId || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Informe item e quantidade inteira maior que zero." }, { status: 400 });
  }
  if (!reason || reason.length > 160) {
    return NextResponse.json({ error: "Informe destino ou motivo da retirada (até 160 caracteres)." }, { status: 400 });
  }

  const operation = createDepositOperationIdentity(
    funcionario.id,
    idempotencyKey,
    "saida",
    { itemId, quantity, reason },
  );
  try {
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.movimentacao.findUnique({
        where: { id: operation.movementId },
        select: { observacao: true, saldoApos: true },
      });
      if (previous) {
        if (previous.observacao?.includes(operation.marker)) {
          return { quantidade: previous.saldoApos, replayed: true };
        }
        throw Object.assign(new Error("A chave já foi usada para outra operação."), { code: "IDEMPOTENCY_CONFLICT" });
      }

      const local = await tx.localEstoque.findUnique({
        where: { slug: DEPOSITO_SLUG },
        select: { id: true },
      });
      if (!local) throw Object.assign(new Error("O depósito ainda não possui saldo cadastrado."), { code: "EMPTY_DEPOSIT" });
      const saldo = await tx.saldoEstoque.findUnique({
        where: { itemId_localId: { itemId, localId: local.id } },
      });
      const disponivel = (saldo?.quantidade ?? 0) - (saldo?.reservada ?? 0);
      if (!saldo || disponivel < quantity) {
        throw Object.assign(new Error(`Saldo insuficiente no depósito. Disponível: ${Math.max(disponivel, 0)}.`), { code: "INSUFFICIENT_DEPOSIT" });
      }
      const saldoDepois = saldo.quantidade - quantity;
      const updated = await tx.saldoEstoque.updateMany({
        where: { id: saldo.id, quantidade: saldo.quantidade, reservada: saldo.reservada },
        data: { quantidade: saldoDepois },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error("O saldo do depósito mudou. Atualize a tela e tente novamente."), { code: "DEPOSIT_CHANGED" });
      }
      await tx.movimentacao.create({
        data: {
          id: operation.movementId,
          tipo: TipoMovimentacao.SAIDA,
          quantidade: quantity,
          saldoApos: saldoDepois,
          reservadaApos: saldo.reservada,
          funcionarioId: funcionario.id,
          saldoEstoqueId: saldo.id,
          observacao: `Retirada para reaproveitamento: ${reason}. ${operation.marker}`.slice(0, 500),
        },
      });
      return { quantidade: saldoDepois, replayed: false };
    });
    return NextResponse.json({
      message: result.replayed ? "Esta retirada já havia sido registrada." : "Retirada para reaproveitamento registrada.",
      deposito: { itemId, quantidade: result.quantidade },
      replayed: result.replayed,
    }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const knownStatus: Record<string, number> = {
      IDEMPOTENCY_CONFLICT: 409,
      EMPTY_DEPOSIT: 404,
      INSUFFICIENT_DEPOSIT: 409,
      DEPOSIT_CHANGED: 409,
    };
    if (typeof code === "string" && knownStatus[code]) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível retirar a sobra." }, { status: knownStatus[code] });
    }
    const errorId = randomUUID();
    console.error("Falha ao retirar sobra do depósito", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A retirada foi processada simultaneamente; atualize os saldos." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível retirar a sobra.", errorId }, { status: 500 });
  }
}
