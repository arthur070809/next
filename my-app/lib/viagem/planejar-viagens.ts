export type PrioridadeViagem = "PRIORITARIO" | "PADRAO" | "prioridade" | "padrao";

export interface ItemRequisicaoViagem {
  itemId: string;
  nome: string;
  quantidade: number;
  local: { id: string; nome: string } | null;
}

export interface RequisicaoViagemInput {
  id: string;
  numeroPedido: string;
  prioridade: PrioridadeViagem;
  criadoEm: string | Date;
  itens: readonly ItemRequisicaoViagem[];
}

export interface ItemViagem {
  itemId: string;
  nome: string;
  quantidadeTotal: number;
  requisicoes: Array<{ numeroPedido: string; quantidade: number }>;
}

export interface RequisicaoNaViagem {
  id: string;
  numeroPedido: string;
  prioridade: PrioridadeViagem;
  criadoEm: string;
  itens: ItemViagem[];
}

export interface ViagemPorLocal {
  localId: string | null;
  localNome: string;
  requisicoes: RequisicaoNaViagem[];
  itens: ItemViagem[];
  quantidadeRequisicoes: number;
  quantidadeItens: number;
}

export interface PlanoViagens {
  viagens: ViagemPorLocal[];
  metricas: {
    idasSemAgrupar: number;
    idasAgrupadas: number;
    idasEconomizadas: number;
  };
}

interface ItemAgrupado extends ItemViagem {
  quantidadePorRequisicao: Map<string, number>;
}

interface ViagemAgrupada {
  localId: string | null;
  localNome: string;
  requisicoes: Map<string, RequisicaoNaViagem>;
  itens: Map<string, ItemAgrupado>;
  prioridadeMinima: number;
  criadoEmMinimo: number;
}

const SEM_ORIGEM_KEY = "__sem_origem__";

function prioridadeRank(prioridade: PrioridadeViagem): number {
  return prioridade === "PRIORITARIO" || prioridade === "prioridade" ? 0 : 1;
}

function timestamp(data: string | Date): number {
  const resultado = data instanceof Date ? data.getTime() : Date.parse(data);
  return Number.isFinite(resultado) ? resultado : Number.MAX_SAFE_INTEGER;
}

function compararRequisicoes(
  esquerda: Pick<RequisicaoViagemInput, "prioridade" | "criadoEm" | "numeroPedido">,
  direita: Pick<RequisicaoViagemInput, "prioridade" | "criadoEm" | "numeroPedido">,
): number {
  return (
    prioridadeRank(esquerda.prioridade) - prioridadeRank(direita.prioridade) ||
    timestamp(esquerda.criadoEm) - timestamp(direita.criadoEm) ||
    esquerda.numeroPedido.localeCompare(direita.numeroPedido)
  );
}

export function planejarViagens(
  requisicoes: readonly RequisicaoViagemInput[],
): PlanoViagens {
  const grupos = new Map<string, ViagemAgrupada>();
  let idasSemAgrupar = 0;

  const requisicoesOrdenadas = [...requisicoes].sort(compararRequisicoes);

  for (const requisicao of requisicoesOrdenadas) {
    const locaisDaRequisicao = new Set(
      requisicao.itens.map((item) => item.local?.id ?? SEM_ORIGEM_KEY),
    );
    idasSemAgrupar += locaisDaRequisicao.size;

    const requisicaoPorLocal = new Map<string, ItemRequisicaoViagem[]>();
    for (const item of requisicao.itens) {
      const localKey = item.local?.id ?? SEM_ORIGEM_KEY;
      const itens = requisicaoPorLocal.get(localKey) ?? [];
      itens.push(item);
      requisicaoPorLocal.set(localKey, itens);
    }

    for (const [localKey, itensDaRequisicao] of requisicaoPorLocal) {
      const local = itensDaRequisicao[0]?.local ?? null;
      let grupo = grupos.get(localKey);
      if (!grupo) {
        grupo = {
          localId: local?.id ?? null,
          localNome: local?.nome ?? "Sem origem",
          requisicoes: new Map(),
          itens: new Map(),
          prioridadeMinima: prioridadeRank(requisicao.prioridade),
          criadoEmMinimo: timestamp(requisicao.criadoEm),
        };
        grupos.set(localKey, grupo);
      } else {
        grupo.prioridadeMinima = Math.min(
          grupo.prioridadeMinima,
          prioridadeRank(requisicao.prioridade),
        );
        grupo.criadoEmMinimo = Math.min(
          grupo.criadoEmMinimo,
          timestamp(requisicao.criadoEm),
        );
      }

      const requisicaoViagem: RequisicaoNaViagem = {
        id: requisicao.id,
        numeroPedido: requisicao.numeroPedido,
        prioridade: requisicao.prioridade,
        criadoEm:
          requisicao.criadoEm instanceof Date
            ? requisicao.criadoEm.toISOString()
            : requisicao.criadoEm,
        itens: [],
      };

      for (const item of itensDaRequisicao) {
        let itemAgrupado = grupo.itens.get(item.itemId);
        if (!itemAgrupado) {
          itemAgrupado = {
            itemId: item.itemId,
            nome: item.nome,
            quantidadeTotal: 0,
            requisicoes: [],
            quantidadePorRequisicao: new Map(),
          };
          grupo.itens.set(item.itemId, itemAgrupado);
        }
        itemAgrupado.quantidadeTotal += item.quantidade;
        itemAgrupado.quantidadePorRequisicao.set(
          requisicao.numeroPedido,
          (itemAgrupado.quantidadePorRequisicao.get(requisicao.numeroPedido) ?? 0) +
            item.quantidade,
        );
      }

      grupo.requisicoes.set(requisicao.id, requisicaoViagem);
    }
  }

  const viagens = [...grupos.values()]
    .sort(
      (a, b) =>
        a.prioridadeMinima - b.prioridadeMinima ||
        a.criadoEmMinimo - b.criadoEmMinimo ||
        (a.localNome === "Sem origem" ? 1 : b.localNome === "Sem origem" ? -1 : 0) ||
        a.localNome.localeCompare(b.localNome),
    )
    .map((grupo) => {
      const itens = [...grupo.itens.values()]
        .map(({ quantidadePorRequisicao, ...item }): ItemViagem => ({
          ...item,
          requisicoes: [...quantidadePorRequisicao.entries()].map(
            ([numeroPedido, quantidade]) => ({ numeroPedido, quantidade }),
          ),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      const requisicoesDoGrupo = [...grupo.requisicoes.values()].sort(
        compararRequisicoes,
      );

      for (const requisicao of requisicoesDoGrupo) {
        requisicao.itens = itens
          .filter((item) =>
            item.requisicoes.some(
              (entrada) => entrada.numeroPedido === requisicao.numeroPedido,
            ),
          )
          .map((item) => ({
            ...item,
            requisicoes: item.requisicoes.filter(
              (entrada) => entrada.numeroPedido === requisicao.numeroPedido,
            ),
          }));
      }

      return {
        localId: grupo.localId,
        localNome: grupo.localNome,
        requisicoes: requisicoesDoGrupo,
        itens,
        quantidadeRequisicoes: requisicoesDoGrupo.length,
        quantidadeItens: itens.length,
      };
    });

  const idasAgrupadas = viagens.length;
  return {
    viagens,
    metricas: {
      idasSemAgrupar,
      idasAgrupadas,
      idasEconomizadas: Math.max(0, idasSemAgrupar - idasAgrupadas),
    },
  };
}
