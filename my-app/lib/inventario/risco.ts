import { MAX_STOCK_BALANCE } from "../stock-units";

export const PESOS_RISCO_INVENTARIO = {
  movimentacoesRecentes: 30,
  escalaMovimentacoes: 20,
  divergenciasRecentes: 30,
  escalaDivergencias: 5,
  diasSemContagem: 25,
  escalaDiasSemContagem: 90,
  saldoBaixo: 15,
} as const;

export interface ItemRiscoInput {
  id: string;
  codigo: string;
  saldo: number;
  pontoReposicao: number;
}

export interface ContextoRisco {
  movimentacoesRecentes: number;
  divergenciasRecentes: number;
  diasDesdeUltimaContagem: number | null;
}

export interface ItemSelecionavel {
  id: string;
  codigo: string;
  risco: number;
}

function validarInteiroNaoNegativo(
  valor: number,
  campo: string,
  limite = MAX_STOCK_BALANCE,
): void {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > limite) {
    throw new RangeError(`${campo} deve ser um inteiro não negativo dentro do limite permitido.`);
  }
}

export function pontuarRisco(item: ItemRiscoInput, contexto: ContextoRisco): number {
  validarInteiroNaoNegativo(item.saldo, "saldo");
  validarInteiroNaoNegativo(item.pontoReposicao, "pontoReposicao");
  validarInteiroNaoNegativo(contexto.movimentacoesRecentes, "movimentacoesRecentes");
  validarInteiroNaoNegativo(contexto.divergenciasRecentes, "divergenciasRecentes");
  if (contexto.diasDesdeUltimaContagem !== null) {
    validarInteiroNaoNegativo(contexto.diasDesdeUltimaContagem, "diasDesdeUltimaContagem");
  }

  const movimentacao = Math.min(
    PESOS_RISCO_INVENTARIO.movimentacoesRecentes,
    contexto.movimentacoesRecentes /
      PESOS_RISCO_INVENTARIO.escalaMovimentacoes *
      PESOS_RISCO_INVENTARIO.movimentacoesRecentes,
  );
  const divergencia = Math.min(
    PESOS_RISCO_INVENTARIO.divergenciasRecentes,
    contexto.divergenciasRecentes /
      PESOS_RISCO_INVENTARIO.escalaDivergencias *
      PESOS_RISCO_INVENTARIO.divergenciasRecentes,
  );
  const diasSemContagem = contexto.diasDesdeUltimaContagem === null
    ? PESOS_RISCO_INVENTARIO.diasSemContagem
    : Math.min(
      PESOS_RISCO_INVENTARIO.diasSemContagem,
      contexto.diasDesdeUltimaContagem /
        PESOS_RISCO_INVENTARIO.escalaDiasSemContagem *
        PESOS_RISCO_INVENTARIO.diasSemContagem,
    );
  const saldoBaixo = item.pontoReposicao === 0
    ? item.saldo === 0 ? PESOS_RISCO_INVENTARIO.saldoBaixo : 0
    : Math.max(
      0,
      (1 - Math.min(1, item.saldo / item.pontoReposicao)) *
        PESOS_RISCO_INVENTARIO.saldoBaixo,
    );
  const total = Math.round(movimentacao + divergencia + diasSemContagem + saldoBaixo);
  return Math.max(0, Math.min(100, total));
}

export function selecionarParaContagem(
  itens: readonly ItemSelecionavel[],
  limite = 3,
): ItemSelecionavel[] {
  validarInteiroNaoNegativo(limite, "limite", 1000);
  const porId = new Map<string, ItemSelecionavel>();
  for (const item of itens) {
    if (!item.id || !item.codigo) throw new RangeError("Cada item deve ter id e código.");
    validarInteiroNaoNegativo(item.risco, "risco");
    if (item.risco > 100) throw new RangeError("risco deve estar entre 0 e 100.");
    const atual = porId.get(item.id);
    if (!atual || item.risco > atual.risco ||
      (item.risco === atual.risco && item.codigo.localeCompare(atual.codigo) < 0)) {
      porId.set(item.id, { id: item.id, codigo: item.codigo, risco: item.risco });
    }
  }
  return [...porId.values()]
    .sort((a, b) => b.risco - a.risco || a.codigo.localeCompare(b.codigo) || a.id.localeCompare(b.id))
    .slice(0, limite);
}
