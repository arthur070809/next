export interface RequisicaoParaAssumir {
  numeroPedido: string;
}

export type ResultadoAssuncaoLote =
  | { numeroPedido: string; tipo: "assumida" }
  | { numeroPedido: string; tipo: "ja-assumida"; atendente: string }
  | { numeroPedido: string; tipo: "erro"; mensagem: string };

type CorpoResposta = {
  error?: string;
  assumidaPor?: string | null;
};

export class ExecutorAssuncaoLote {
  private emExecucao = false;

  async executar(
    requisicoes: readonly RequisicaoParaAssumir[],
    codigoCracha: string,
    assumir: (requisicao: RequisicaoParaAssumir, codigoCracha: string) => Promise<Response>,
  ): Promise<ResultadoAssuncaoLote[] | null> {
    if (this.emExecucao) return null;
    this.emExecucao = true;

    try {
      const resultados: ResultadoAssuncaoLote[] = [];
      for (const requisicao of requisicoes) {
        try {
          const resposta = await assumir(requisicao, codigoCracha);
          const corpo = await resposta.json() as CorpoResposta;
          if (resposta.ok) {
            resultados.push({ numeroPedido: requisicao.numeroPedido, tipo: "assumida" });
          } else if (resposta.status === 409) {
            resultados.push({
              numeroPedido: requisicao.numeroPedido,
              tipo: "ja-assumida",
              atendente: corpo.assumidaPor ?? "outro almoxarife",
            });
          } else {
            resultados.push({
              numeroPedido: requisicao.numeroPedido,
              tipo: "erro",
              mensagem: corpo.error ?? "Não foi possível assumir a requisição.",
            });
          }
        } catch {
          resultados.push({
            numeroPedido: requisicao.numeroPedido,
            tipo: "erro",
            mensagem: "Falha de comunicação ao assumir a requisição.",
          });
        }
      }
      return resultados;
    } finally {
      this.emExecucao = false;
    }
  }
}
