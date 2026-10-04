import {
  ErroMovimentacao,
  MAX_QUANTIDADE,
  type EstadoContaEstoque,
} from "./types";

export function validarQuantidade(
  valor: unknown,
  nome: string,
  permitirZero = true,
): number {
  if (
    typeof valor !== "number" ||
    !Number.isSafeInteger(valor) ||
    valor < 0 ||
    (!permitirZero && valor === 0)
  ) {
    throw new ErroMovimentacao(
      "QUANTIDADE_INVALIDA",
      `${nome} deve ser um inteiro não negativo${permitirZero ? "" : " maior que zero"}.`,
    );
  }

  if (valor > MAX_QUANTIDADE) {
    throw new ErroMovimentacao(
      "LIMITE_EXCEDIDO",
      `${nome} excede o limite máximo de ${MAX_QUANTIDADE}.`,
    );
  }

  return valor;
}

export function validarEstado(estado: EstadoContaEstoque): void {
  validarQuantidade(estado.fisico, "Físico");
  validarQuantidade(estado.aSeparar, "A separar");
  validarQuantidade(estado.emPosse, "Em posse");

  if (!estado.aSepararPorRequisicao || typeof estado.aSepararPorRequisicao !== "object") {
    throw new ErroMovimentacao(
      "ESTADO_INVALIDO",
      "Alocações por requisição inválidas.",
    );
  }

  let totalAlocado = 0;
  for (const [requisicaoId, quantidade] of Object.entries(
    estado.aSepararPorRequisicao,
  )) {
    if (!requisicaoId) {
      throw new ErroMovimentacao("ESTADO_INVALIDO", "Identificador de requisição vazio.");
    }
    totalAlocado += validarQuantidade(quantidade, "Alocação da requisição");
    if (totalAlocado > MAX_QUANTIDADE) {
      throw new ErroMovimentacao(
        "LIMITE_EXCEDIDO",
        "A soma das alocações excede o limite máximo.",
      );
    }
  }

  if (totalAlocado !== estado.aSeparar) {
    throw new ErroMovimentacao(
      "ESTADO_INVALIDO",
      "O saldo A separar não corresponde às alocações por requisição.",
    );
  }
}

export function validarSoma(valor: number, nome: string): number {
  if (valor > MAX_QUANTIDADE) {
    throw new ErroMovimentacao(
      "LIMITE_EXCEDIDO",
      `${nome} excede o limite máximo de ${MAX_QUANTIDADE}.`,
    );
  }
  return valor;
}
