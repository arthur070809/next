import {
  JANELA_CONSUMO_PADRAO_DIAS,
  type MovimentoHistoricoRessuprimento,
} from "./analise";

function hashTexto(texto: string): number {
  let hash = 2166136261;
  for (let index = 0; index < texto.length; index += 1) {
    hash ^= texto.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gerador(seedInicial: number): () => number {
  let seed = seedInicial >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
}

export function gerarMovimentosSimulados(
  itemId: string,
  hoje = new Date(),
  janelaDias = JANELA_CONSUMO_PADRAO_DIAS,
): MovimentoHistoricoRessuprimento[] {
  if (!Number.isSafeInteger(janelaDias) || janelaDias < 1 || janelaDias > 3660) {
    throw new RangeError("janelaDias deve ser um inteiro entre 1 e 3660.");
  }
  if (!Number.isFinite(hoje.getTime())) throw new RangeError("hoje deve ser uma data válida.");

  const proximo = gerador(hashTexto(itemId));
  const inicioHoje = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const movimentos: MovimentoHistoricoRessuprimento[] = [];
  for (let indiceDia = 0; indiceDia < janelaDias; indiceDia += 1) {
    const dentroDoPico = indiceDia >= janelaDias - 10 && indiceDia < janelaDias - 3;
    const ocorreSaida = dentroDoPico || proximo() % 3 === 0;
    if (!ocorreSaida) continue;

    const quantidade = dentroDoPico
      ? 6 + (proximo() % 5)
      : 1 + (proximo() % 3);
    const dia = new Date(inicioHoje - (janelaDias - indiceDia - 1) * 86_400_000);
    dia.setUTCHours(12, 0, 0, 0);
    movimentos.push({
      tipo: "SAIDA",
      quantidade,
      criadoEm: dia.toISOString(),
    });
  }
  return movimentos;
}
