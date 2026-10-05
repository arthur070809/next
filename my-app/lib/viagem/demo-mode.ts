import { requisicoesDemonstracao } from "./demo-data";
import { planejarViagens, type PlanoViagens } from "./planejar-viagens";

export function viagemDemoDisponivel(
  nodeEnv: string | undefined,
  flagPublica: string | undefined,
): boolean {
  return nodeEnv !== "production" || flagPublica === "true";
}

export const planoViagemDemonstracao = planejarViagens(requisicoesDemonstracao);

export async function consultarDadosReais<T>(
  modoDemonstracao: boolean,
  buscar: () => Promise<T>,
): Promise<T | null> {
  if (modoDemonstracao) return null;
  return buscar();
}

export async function carregarPlanoViagem(
  modoDemonstracao: boolean,
  buscarPlanoReal: () => Promise<PlanoViagens>,
): Promise<PlanoViagens> {
  if (modoDemonstracao) return planoViagemDemonstracao;
  return buscarPlanoReal();
}
