import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { requireAlmoxarife } from "@/lib/auth";
import { TipoMovimentacao } from "@/generated/prisma/client";

const LOCAL_DEPOSITO_SLUG = "deposito";

export async function GET(request: Request) {
  try {
    const { funcionario, status } = await requireAlmoxarife();
    if (!funcionario) {
      return NextResponse.json({
        error: status === 401 ? "Não autenticado." : "Acesso permitido apenas ao almoxarife ou admin.",
      }, { status });
    }
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    const showZeroBalances = params.get("zerados") === "true";
    const rows = await prisma.item.findMany({
      where: {
        ativo: true,
        ...(query ? { OR: [{ nome: { contains: query } }, { codigo: { contains: query } }] } : {}),
      },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        codigo: true,
        categoria: true,
        saldos: {
          where: { local: { slug: LOCAL_DEPOSITO_SLUG } },
          select: {
            quantidade: true,
            movimentacoes: {
              orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
              take: 1,
              select: { criadoEm: true },
            },
          },
        },
      },
    });
    const itens = rows.map((item) => {
      const saldo = item.saldos[0];
      return {
        id: item.id,
        nome: item.nome,
        codigo: item.codigo,
        categoria: item.categoria,
        quantidade: saldo?.quantidade ?? 0,
        ultimaMovimentacaoEm: saldo?.movimentacoes[0]?.criadoEm ?? null,
      };
    }).filter((item) => showZeroBalances || item.quantidade > 0);
    return NextResponse.json({ itens });
  } catch (error) {
    console.error("Falha ao carregar saldos do depósito", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível carregar os saldos do depósito." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { funcionario, status } = await requireAlmoxarife();
    if (!funcionario) {
      return NextResponse.json({
        error: status === 401 ? "Não autenticado." : "Ajuste permitido apenas para almoxarife ou admin.",
      }, { status });
    }
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json();
    const itemId = typeof body?.estoqueItemId === "string" ? body.estoqueItemId
      : typeof body?.itemId === "string" ? body.itemId : "";
    const quantidade = Number(body?.quantidade);

    if (!itemId || !Number.isInteger(quantidade) || quantidade < 0) {
      return NextResponse.json({ error: "Item ou quantidade do depósito inválida." }, { status: 400 });
    }

    const deposito = await prisma.$transaction(async (tx) => {
      // Garante que o local "deposito" existe
      const local = await tx.localEstoque.upsert({
        where: { slug: LOCAL_DEPOSITO_SLUG },
        create: { slug: LOCAL_DEPOSITO_SLUG, nome: "Depósito", ativo: true },
        update: {},
      });

      // Verifica que o item existe
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) throw Object.assign(new Error("Item não encontrado"), { code: "P2025" });

      const saldoAnterior = await tx.saldoEstoque.findUnique({
        where: { itemId_localId: { itemId, localId: local.id } },
      });
      const qtdAnterior = saldoAnterior?.quantidade ?? 0;

      const saldo = await tx.saldoEstoque.upsert({
        where: { itemId_localId: { itemId, localId: local.id } },
        create: { itemId, localId: local.id, quantidade, reservada: 0 },
        update: { quantidade },
      });

      // Registra movimentação de ajuste no depósito
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.AJUSTE,
          quantidade: Math.abs(quantidade - qtdAnterior),
          saldoApos: saldo.quantidade,
          reservadaApos: saldo.reservada,
          funcionarioId: funcionario.id,
          saldoEstoqueId: saldo.id,
          observacao: `Ajuste depósito: ${qtdAnterior} → ${quantidade}`,
        },
      });

      return {
        estoqueItemId: itemId,
        quantidade: saldo.quantidade,
      };
    });

    return NextResponse.json({ deposito });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2025") return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    console.error("Erro ao atualizar depósito:", error instanceof Error ? error.message : "erro");
    return NextResponse.json({ error: "Não foi possível atualizar o depósito." }, { status: 500 });
  }
}