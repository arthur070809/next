import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  let funcionario;
  try {
    funcionario = await getAuthenticatedFuncionario();
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao validar sessão para sobra", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível validar a sessão.", errorId }, { status: 500 });
  }
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: "Atualize a tela e tente registrar novamente." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie uma quantidade válida." }, { status: 400 });
  }
  const quantidade = body.quantidade;
  if (typeof quantidade !== "number" || !Number.isSafeInteger(quantidade) || quantidade < 1) {
    return NextResponse.json({ error: "Informe uma quantidade inteira maior que zero." }, { status: 400 });
  }

  const { id } = await params;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (transaction) => {
          const movement = await transaction.movimentacaoDeposito.findUnique({ where: { idempotencyKey } });
          if (movement) {
            const saldo = await transaction.saldoDeposito.findUnique({ where: { itemId: movement.itemId }, select: { quantidade: true } });
            return { duplicate: true, quantidade, saldo: saldo?.quantidade ?? movement.saldoDepois, requisicaoId: movement.requisicaoId };
          }

          const requisicao = await transaction.requisicao.findUnique({ where: { id }, include: { estoqueItem: true } });
          if (!requisicao || requisicao.status !== "RETIRADA" || !requisicao.estoqueItemId) {
            throw new Error("REQUISICAO_NAO_DEVOLVIVEL");
          }

          const limite = requisicao.quantidade - requisicao.qtdDevolvida;
          if (quantidade > limite) throw new Error(`LIMITE:${limite}`);

          const updated = await transaction.requisicao.updateMany({
            where: {
              id,
              status: "RETIRADA",
              quantidade: { gte: requisicao.qtdDevolvida + quantidade },
              qtdDevolvida: { equals: requisicao.qtdDevolvida },
            },
            data: { qtdDevolvida: { increment: quantidade } },
          });
          if (updated.count !== 1) throw new Error("CONCORRENCIA");

          const saldoAnterior = await transaction.saldoDeposito.findUnique({
            where: { itemId: requisicao.estoqueItemId },
            select: { quantidade: true },
          });
          const saldoAntes = saldoAnterior?.quantidade ?? 0;
          await transaction.saldoDeposito.upsert({
            where: { itemId: requisicao.estoqueItemId },
            create: { itemId: requisicao.estoqueItemId, quantidade },
            update: { quantidade: { increment: quantidade } },
          });
          const saldoDepois = saldoAntes + quantidade;

          await transaction.movimentacaoDeposito.create({
            data: {
              itemId: requisicao.estoqueItemId,
              tipo: "ENTRADA_SOBRA",
              quantidade,
              saldoAntes,
              saldoDepois,
              requisicaoId: requisicao.id,
              usuarioId: funcionario.id,
              idempotencyKey,
            },
          });
          return { duplicate: false, quantidade, saldo: saldoDepois, requisicaoId: requisicao.id, numero: requisicao.numero, item: requisicao.item };
        }, { isolationLevel: "Serializable" });

        if (result.duplicate) return NextResponse.json({ error: "Esta sobra já foi registrada.", saldo: result.saldo }, { status: 409 });
        return NextResponse.json({
          message: `Sobra registrada: ${quantidade} un da requisição #${result.numero}. Saldo do depósito: ${result.saldo}.`,
          saldo: result.saldo,
          qtdDevolvida: quantidade,
        }, { status: 201 });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("LIMITE:")) {
          const limite = Number(error.message.slice("LIMITE:".length));
          return NextResponse.json({ error: `Só é possível devolver até ${limite} unidades desta requisição.` }, { status: 400 });
        }
        if (error instanceof Error && error.message === "REQUISICAO_NAO_DEVOLVIVEL") {
          return NextResponse.json({ error: "Esta requisição não aceita sobra porque foi cancelada ou ainda não foi retirada." }, { status: 400 });
        }
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if (code === "P2002") {
          return NextResponse.json({ error: "Esta sobra já foi registrada." }, { status: 409 });
        }
        if ((error instanceof Error && error.message === "CONCORRENCIA") || code === "P2034") {
          if (attempt < 2) continue;
          return NextResponse.json({ error: "A requisição mudou durante o registro. Atualize e tente novamente." }, { status: 409 });
        }
        throw error;
      }
    }
    return NextResponse.json({ error: "A requisição mudou durante o registro. Atualize e tente novamente." }, { status: 409 });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao registrar sobra", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível registrar a sobra.", errorId }, { status: 500 });
  }
}