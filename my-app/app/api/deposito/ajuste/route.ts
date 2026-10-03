import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { TipoMovimentacao } from "@/generated/prisma/client";

const LOCAL_DEPOSITO_SLUG = "deposito";

export async function POST(request: Request) {
  let authorization;
  try {
    authorization = await requireAdmin();
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao validar permissão de ajuste", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível validar a permissão.", errorId }, { status: 500 });
  }
  const { funcionario, status } = authorization;
  if (!funcionario) return NextResponse.json({ error: status === 401 ? "Não autenticado." : "Ajuste permitido apenas para admin." }, { status });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie os dados do ajuste em formato válido." }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const quantidade = body.quantidade;
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!itemId || typeof quantidade !== "number" || !Number.isSafeInteger(quantidade) || quantidade < 0) {
    return NextResponse.json({ error: "Informe o item e uma quantidade inteira maior ou igual a zero." }, { status: 400 });
  }
  if (!motivo || motivo.length > 200) return NextResponse.json({ error: "Informe um motivo curto para o ajuste (até 200 caracteres)." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.item.findUnique({ where: { id: itemId }, select: { id: true, ativo: true } });
      if (!item || !item.ativo) return null;

      const local = await transaction.localEstoque.upsert({
        where: { slug: LOCAL_DEPOSITO_SLUG },
        create: { slug: LOCAL_DEPOSITO_SLUG, nome: "Depósito", ativo: true },
        update: {},
      });

      const saldoAtual = await transaction.saldoEstoque.findUnique({
        where: { itemId_localId: { itemId, localId: local.id } },
      });
      const saldoAntes = saldoAtual?.quantidade ?? 0;
      if (saldoAntes === quantidade) return { saldoAntes, saldoDepois: quantidade, alterado: false };

      const saldo = await transaction.saldoEstoque.upsert({
        where: { itemId_localId: { itemId, localId: local.id } },
        create: { itemId, localId: local.id, quantidade, reservada: 0 },
        update: { quantidade },
      });

      await transaction.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.AJUSTE,
          quantidade: Math.abs(quantidade - saldoAntes),
          saldoApos: saldo.quantidade,
          reservadaApos: saldo.reservada,
          funcionarioId: funcionario.id,
          saldoEstoqueId: saldo.id,
          observacao: `Ajuste depósito: ${saldoAntes} para ${quantidade}. Motivo: ${motivo}`.slice(0, 500),
        },
      });
      return { saldoAntes, saldoDepois: quantidade, alterado: true };
    });

    if (!result) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ ajuste: result });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao ajustar saldo do depósito", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível ajustar o saldo.", errorId }, { status: 500 });
  }
}