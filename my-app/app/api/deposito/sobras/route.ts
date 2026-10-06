import { NextResponse } from "next/server";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeItemDescription } from "@/lib/requisition-metadata";
import { LOCAL_ESTOQUE_SLUG } from "@/lib/stock-locations";

const LOCAL_DEPOSITO_SLUG = "deposito";

export async function GET() {
  try {
    const { funcionario, status } = await requireAlmoxarife();
    if (!funcionario) {
      return NextResponse.json({
        error: status === 401 ? "Não autenticado." : "Acesso permitido apenas ao almoxarife ou admin.",
      }, { status });
    }

    const rows = await prisma.requisicaoItem.findMany({
      where: {
        motivoNaoAtendido: "EXCEDEU_LOTE_MINIMO",
        requisicao: { is: { status: "CONCLUIDA" } },
      },
      orderBy: [{ requisicao: { concluidaEm: "desc" } }],
      select: {
        id: true,
        quantidade: true,
        descricao: true,
        item: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            categoria: true,
            saldos: {
              where: { local: { slug: { in: [LOCAL_ESTOQUE_SLUG, LOCAL_DEPOSITO_SLUG] } } },
              select: { quantidade: true, reservada: true, local: { select: { slug: true } } },
            },
          },
        },
        requisicao: { select: { numeroPedido: true } },
        movimentacoes: {
          where: { tipo: "SAIDA" },
          select: { quantidade: true },
        },
      },
    });

    const agrupados = new Map<string, {
      itemId: string;
      codigo: string | null;
      produto: string;
      categoria: string;
      setor: string;
      quantidadePedida: number;
      quantidadeSeparada: number;
      quantidadeExcedente: number;
      pedidos: string[];
      estoqueLivre: number;
      saldoDeposito: number;
    }>();

    for (const row of rows) {
      const quantidadeSeparada = row.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0);
      const quantidadeExcedente = Math.max(0, quantidadeSeparada - row.quantidade);
      if (quantidadeExcedente === 0) continue;

      const setor = decodeItemDescription(row.descricao).setor ?? "Não informado";
      const key = `${row.item.id}\u0000${setor}`;
      const saldoEstoque = row.item.saldos.find((saldo) => saldo.local.slug === LOCAL_ESTOQUE_SLUG);
      const saldoDeposito = row.item.saldos.find((saldo) => saldo.local.slug === LOCAL_DEPOSITO_SLUG);
      const registro = agrupados.get(key) ?? {
        itemId: row.item.id,
        codigo: row.item.codigo,
        produto: row.item.nome,
        categoria: row.item.categoria,
        setor,
        quantidadePedida: 0,
        quantidadeSeparada: 0,
        quantidadeExcedente: 0,
        pedidos: [],
        estoqueLivre: Math.max(0, (saldoEstoque?.quantidade ?? 0) - (saldoEstoque?.reservada ?? 0)),
        saldoDeposito: saldoDeposito?.quantidade ?? 0,
      };
      registro.quantidadePedida += row.quantidade;
      registro.quantidadeSeparada += quantidadeSeparada;
      registro.quantidadeExcedente += quantidadeExcedente;
      registro.pedidos.push(row.requisicao.numeroPedido);
      agrupados.set(key, registro);
    }

    const registros = [...agrupados.values()].sort((a, b) =>
      a.setor.localeCompare(b.setor) || a.produto.localeCompare(b.produto));
    const totaisPorSetor = [...agrupados.values()].reduce((totals, registro) => {
      const total = totals.get(registro.setor) ?? { setor: registro.setor, quantidadePedida: 0, quantidadeSeparada: 0, quantidadeExcedente: 0 };
      total.quantidadePedida += registro.quantidadePedida;
      total.quantidadeSeparada += registro.quantidadeSeparada;
      total.quantidadeExcedente += registro.quantidadeExcedente;
      totals.set(registro.setor, total);
      return totals;
    }, new Map<string, { setor: string; quantidadePedida: number; quantidadeSeparada: number; quantidadeExcedente: number }>());
    const totaisPorProduto = [...agrupados.values()].reduce((totals, registro) => {
      const total = totals.get(registro.itemId) ?? {
        itemId: registro.itemId,
        produto: registro.produto,
        quantidadePedida: 0,
        quantidadeSeparada: 0,
        quantidadeExcedente: 0,
      };
      total.quantidadePedida += registro.quantidadePedida;
      total.quantidadeSeparada += registro.quantidadeSeparada;
      total.quantidadeExcedente += registro.quantidadeExcedente;
      totals.set(registro.itemId, total);
      return totals;
    }, new Map<string, { itemId: string; produto: string; quantidadePedida: number; quantidadeSeparada: number; quantidadeExcedente: number }>());

    return NextResponse.json({
      registros,
      totaisPorSetor: [...totaisPorSetor.values()],
      totaisPorProduto: [...totaisPorProduto.values()],
      aviso: "Excedente por lote mínimo é quantidade entregue ao solicitante, não uma sobra física registrada. O saldo do depósito é global por produto e não tem vínculo com setor.",
    });
  } catch (error) {
    console.error("Falha ao carregar excedentes por lote mínimo", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível carregar o resumo de sobras." }, { status: 500 });
  }
}
