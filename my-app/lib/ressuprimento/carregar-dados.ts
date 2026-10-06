import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { LOCAL_ESTOQUE_SLUG } from "@/lib/stock-locations";
import {
  historicoRealSuficiente,
  JANELA_CONSUMO_PADRAO_DIAS,
  sugestao,
  type MovimentoHistoricoRessuprimento,
  type SugestaoRessuprimento,
} from "@/lib/ressuprimento/analise";
import { gerarMovimentosSimulados } from "@/lib/ressuprimento/simulado";

const DIA_MS = 86_400_000;

type ResultadoDadosRessuprimento =
  | { ok: true; sugestoes: SugestaoRessuprimento[]; fonte: "Dados reais" | "Dados simulados" }
  | { ok: false; errorId: string };

export async function carregarDadosRessuprimento(hoje: Date): Promise<ResultadoDadosRessuprimento> {
  const inicioJanela = new Date(Date.UTC(
    hoje.getUTCFullYear(),
    hoje.getUTCMonth(),
    hoje.getUTCDate(),
  ) - (JANELA_CONSUMO_PADRAO_DIAS - 1) * DIA_MS);
  try {
    const [itens, movimentos] = await Promise.all([
      prisma.item.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          categoria: true,
          pontoPedido: true,
          saldos: {
            where: { local: { slug: LOCAL_ESTOQUE_SLUG } },
            select: { quantidade: true, reservada: true },
          },
        },
      }),
      prisma.movimentacao.findMany({
        where: {
          tipo: "SAIDA",
          criadoEm: { gte: inicioJanela, lte: hoje },
          saldoEstoque: { local: { slug: LOCAL_ESTOQUE_SLUG } },
        },
        select: {
          quantidade: true,
          criadoEm: true,
          saldoEstoque: { select: { itemId: true } },
        },
      }),
    ]);

    const movimentosPorItem = new Map<string, MovimentoHistoricoRessuprimento[]>();
    for (const movimento of movimentos) {
      const lista = movimentosPorItem.get(movimento.saldoEstoque.itemId) ?? [];
      lista.push({
        tipo: "SAIDA",
        quantidade: movimento.quantidade,
        criadoEm: movimento.criadoEm,
      });
      movimentosPorItem.set(movimento.saldoEstoque.itemId, lista);
    }
    const movimentosReais = [...movimentosPorItem.values()].flat();
    const fonte = historicoRealSuficiente(movimentosReais, hoje)
      ? "Dados reais"
      : "Dados simulados";
    const sugestoes = itens.map((item) => {
      const estoqueLivre = item.saldos.reduce(
        (total, saldo) => total + Math.max(0, saldo.quantidade - saldo.reservada),
        0,
      );
      const movimentosSaida = fonte === "Dados reais"
        ? movimentosPorItem.get(item.id) ?? []
        : gerarMovimentosSimulados(item.id, hoje);
      return sugestao({
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        estoque: estoqueLivre,
        pontoAtual: item.pontoPedido,
        movimentosSaida,
      }, undefined, undefined, hoje);
    });

    return { ok: true, sugestoes, fonte };
  } catch (error) {
    const errorId = randomUUID();
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Falha ao carregar análise de ressuprimento.", { errorId, errorName });
    return { ok: false, errorId };
  }
}
