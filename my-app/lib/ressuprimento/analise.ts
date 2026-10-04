import { MAX_STOCK_BALANCE } from "../stock-units";

export const PRAZO_REPOSICAO_PADRAO_DIAS = 7;
export const MARGEM_SEGURANCA_DIAS = 2;
export const JANELA_CONSUMO_PADRAO_DIAS = 30;

export type ClasseRessuprimento = "VERDE" | "AMARELO" | "VERMELHO" | "SEM_DADOS";
export type ConfiancaRessuprimento = "BAIXA" | "ADEQUADA";

export interface MovimentoHistoricoRessuprimento {
  tipo?: string;
  quantidade: number;
  criadoEm: string | Date;
}

export interface ItemRessuprimentoInput {
  id: string;
  nome: string;
  estoque: number;
  pontoAtual: number;
  movimentosSaida: readonly MovimentoHistoricoRessuprimento[];
}

export interface SugestaoRessuprimento {
  id: string;
  nome: string;
  estoque: number;
  consumoDiario: number | null;
  diasCobertura: number | null;
  pontoAtual: number;
  pontoSugerido: number | null;
  classe: ClasseRessuprimento;
  confianca: ConfiancaRessuprimento;
}

function inteiroNaoNegativo(valor: number, nome: string, limite = MAX_STOCK_BALANCE): void {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > limite) {
    throw new RangeError(`${nome} deve ser um inteiro não negativo dentro do limite permitido.`);
  }
}

function inicioDoDiaUtc(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

function obterData(data: string | Date): Date | null {
  const resultado = data instanceof Date ? data : new Date(data);
  return Number.isFinite(resultado.getTime()) ? resultado : null;
}

function movimentosValidos(
  movimentos: readonly MovimentoHistoricoRessuprimento[],
  hoje: Date,
  janelaDias: number,
): Array<{ quantidade: number; data: Date }> {
  const inicio = inicioDoDiaUtc(hoje) - (janelaDias - 1) * 86_400_000;
  const fim = inicioDoDiaUtc(hoje) + 86_400_000;
  return movimentos.flatMap((movimento) => {
    if (movimento.tipo !== undefined && movimento.tipo !== "SAIDA") return [];
    if (
      !Number.isSafeInteger(movimento.quantidade) ||
      movimento.quantidade <= 0 ||
      movimento.quantidade > MAX_STOCK_BALANCE
    ) return [];
    const data = obterData(movimento.criadoEm);
    if (!data || data.getTime() < inicio || data.getTime() >= fim) return [];
    return [{ quantidade: movimento.quantidade, data }];
  });
}

export function consumoMedioDiario(
  movimentosSaida: readonly MovimentoHistoricoRessuprimento[],
  janelaDias = JANELA_CONSUMO_PADRAO_DIAS,
  hoje = new Date(),
): number | null {
  inteiroNaoNegativo(janelaDias, "janelaDias", 3660);
  if (janelaDias === 0) throw new RangeError("janelaDias deve ser maior que zero.");
  if (!Number.isFinite(hoje.getTime())) throw new RangeError("hoje deve ser uma data válida.");
  const movimentos = movimentosValidos(movimentosSaida, hoje, janelaDias);
  if (movimentos.length === 0) return null;
  return movimentos.reduce((total, movimento) => total + movimento.quantidade, 0) / janelaDias;
}

export function diasDeCobertura(estoque: number, consumoDiario: number | null): number {
  inteiroNaoNegativo(estoque, "estoque");
  if (consumoDiario === null || consumoDiario === 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(consumoDiario) || consumoDiario < 0) {
    throw new RangeError("consumoDiario deve ser nulo ou um número finito não negativo.");
  }
  return estoque / consumoDiario;
}

export function pontoSugerido(
  consumoDiario: number | null,
  prazoDias = PRAZO_REPOSICAO_PADRAO_DIAS,
  margemDias = MARGEM_SEGURANCA_DIAS,
): number | null {
  inteiroNaoNegativo(prazoDias, "prazoDias", 3660);
  inteiroNaoNegativo(margemDias, "margemDias", 3660);
  if (consumoDiario === null) return null;
  if (!Number.isFinite(consumoDiario) || consumoDiario < 0) {
    throw new RangeError("consumoDiario deve ser nulo ou um número finito não negativo.");
  }
  const sugestao = Math.ceil(consumoDiario * (prazoDias + margemDias));
  if (!Number.isSafeInteger(sugestao) || sugestao > MAX_STOCK_BALANCE) {
    throw new RangeError("O ponto sugerido excede o limite permitido.");
  }
  return sugestao;
}

export function classificar(
  diasCobertura: number | null,
  prazoDias = PRAZO_REPOSICAO_PADRAO_DIAS,
): ClasseRessuprimento {
  inteiroNaoNegativo(prazoDias, "prazoDias", 3660);
  if (diasCobertura === null) return "SEM_DADOS";
  if (Number.isNaN(diasCobertura) || diasCobertura < 0) {
    throw new RangeError("diasCobertura deve ser nulo ou não negativo.");
  }
  if (diasCobertura < prazoDias) return "VERMELHO";
  if (diasCobertura <= prazoDias * 2) return "AMARELO";
  return "VERDE";
}

export function historicoRealSuficiente(
  movimentos: readonly MovimentoHistoricoRessuprimento[],
  hoje = new Date(),
  janelaDias = JANELA_CONSUMO_PADRAO_DIAS,
): boolean {
  inteiroNaoNegativo(janelaDias, "janelaDias", 3660);
  if (janelaDias === 0 || !Number.isFinite(hoje.getTime())) return false;
  const validos = movimentosValidos(movimentos, hoje, janelaDias);
  if (validos.length < 5) return false;
  const primeiraData = Math.min(...validos.map(({ data }) => inicioDoDiaUtc(data)));
  const diasDeHistorico = Math.floor((inicioDoDiaUtc(hoje) - primeiraData) / 86_400_000) + 1;
  return diasDeHistorico >= 7;
}

export function sugestao(
  item: ItemRessuprimentoInput,
  prazoDias = PRAZO_REPOSICAO_PADRAO_DIAS,
  margemDias = MARGEM_SEGURANCA_DIAS,
  hoje = new Date(),
): SugestaoRessuprimento {
  inteiroNaoNegativo(item.estoque, "estoque");
  inteiroNaoNegativo(item.pontoAtual, "pontoAtual");
  const consumoDiario = consumoMedioDiario(item.movimentosSaida, JANELA_CONSUMO_PADRAO_DIAS, hoje);
  const cobertura = diasDeCobertura(item.estoque, consumoDiario);
  const movimentos = movimentosValidos(item.movimentosSaida, hoje, JANELA_CONSUMO_PADRAO_DIAS);
  const primeiraData = movimentos.length
    ? Math.min(...movimentos.map(({ data }) => inicioDoDiaUtc(data)))
    : null;
  const diasDeHistorico = primeiraData === null
    ? 0
    : Math.floor((inicioDoDiaUtc(hoje) - primeiraData) / 86_400_000) + 1;
  const confianca: ConfiancaRessuprimento =
    diasDeHistorico < 7 || movimentos.length < 5 ? "BAIXA" : "ADEQUADA";

  return {
    id: item.id,
    nome: item.nome,
    estoque: item.estoque,
    consumoDiario,
    diasCobertura: Number.isFinite(cobertura) ? cobertura : Number.POSITIVE_INFINITY,
    pontoAtual: item.pontoAtual,
    pontoSugerido: pontoSugerido(consumoDiario, prazoDias, margemDias),
    classe: classificar(consumoDiario === null ? null : cobertura, prazoDias),
    confianca,
  };
}
