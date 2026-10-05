import { MAX_STOCK_BALANCE } from "../stock-units";

export type ResultadoContagem = "BATEU" | "DENTRO_TOLERANCIA" | "DIVERGENTE";
export type AcaoContagem = "CONFIRMAR" | "RECONTAR" | "ABRIR_AJUSTE";

export interface AvaliacaoContagem {
  resultado: ResultadoContagem;
  diferenca: number;
  percentualDiferenca: number | null;
  acaoSugerida: AcaoContagem;
}

export interface IndiceAcuraciaLocal {
  localId: string;
  total: number;
  dentroDoEsperado: number;
  percentual: number;
}

function validarQuantidade(valor: number, campo: string): void {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > MAX_STOCK_BALANCE) {
    throw new RangeError(`${campo} deve ser um inteiro não negativo dentro do limite permitido.`);
  }
}

export function avaliarContagem({
  esperado,
  contado,
  tolerancia,
}: {
  esperado: number;
  contado: number;
  tolerancia: number;
}): AvaliacaoContagem {
  validarQuantidade(esperado, "esperado");
  validarQuantidade(contado, "contado");
  validarQuantidade(tolerancia, "tolerancia");

  const diferenca = contado - esperado;
  const magnitude = Math.abs(diferenca);
  const resultado: ResultadoContagem = magnitude === 0
    ? "BATEU"
    : magnitude <= tolerancia
      ? "DENTRO_TOLERANCIA"
      : "DIVERGENTE";
  const percentualDiferenca = esperado === 0
    ? magnitude === 0 ? 0 : null
    : magnitude / esperado * 100;

  return {
    resultado,
    diferenca,
    percentualDiferenca,
    acaoSugerida: resultado === "DIVERGENTE" ? "RECONTAR" : "CONFIRMAR",
  };
}

export function indiceAcuracia(
  contagens: readonly { localId: string; resultado: ResultadoContagem }[],
): IndiceAcuraciaLocal[] {
  const porLocal = new Map<string, { total: number; dentroDoEsperado: number }>();
  for (const contagem of contagens) {
    if (!contagem.localId) throw new RangeError("Cada contagem deve ter localId.");
    const local = porLocal.get(contagem.localId) ?? { total: 0, dentroDoEsperado: 0 };
    local.total += 1;
    if (contagem.resultado === "BATEU" || contagem.resultado === "DENTRO_TOLERANCIA") {
      local.dentroDoEsperado += 1;
    }
    porLocal.set(contagem.localId, local);
  }

  return [...porLocal.entries()]
    .sort(([localA], [localB]) => localA.localeCompare(localB))
    .map(([localId, local]) => ({
      localId,
      total: local.total,
      dentroDoEsperado: local.dentroDoEsperado,
      percentual: Math.round(local.dentroDoEsperado / local.total * 10_000) / 100,
    }));
}
