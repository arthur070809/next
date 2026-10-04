import { ErroMovimentacao, type LinhaMovimentoConta } from "./types";
import { validarQuantidade, validarSoma } from "./validacao";

export interface SaldosRecalculados {
  fisico: number;
  aSeparar: number;
  emPosse: number;
}

function diferenca(antes: number, depois: number, campo: string): number {
  validarQuantidade(antes, `${campo} antes`);
  validarQuantidade(depois, `${campo} depois`);
  return depois - antes;
}

export function recalcularSaldos(
  linhas: readonly LinhaMovimentoConta[],
): SaldosRecalculados {
  if (linhas.length === 0) {
    return { fisico: 0, aSeparar: 0, emPosse: 0 };
  }

  const primeira = linhas[0];
  let fisico = validarQuantidade(primeira.fisicoAntes, "Físico inicial");
  let aSeparar = validarQuantidade(primeira.aSepararAntes, "A separar inicial");
  let emPosse = validarQuantidade(primeira.emPosseAntes, "Em posse inicial");

  for (const linha of linhas) {
    validarQuantidade(linha.quantidade, "Quantidade da movimentação");
    fisico = validarSoma(
      fisico + diferenca(linha.fisicoAntes, linha.fisicoDepois, "Físico"),
      "Físico recalculado",
    );
    aSeparar = validarSoma(
      aSeparar +
        diferenca(linha.aSepararAntes, linha.aSepararDepois, "A separar"),
      "A separar recalculado",
    );
    emPosse = validarSoma(
      emPosse +
        diferenca(linha.emPosseAntes, linha.emPosseDepois, "Em posse"),
      "Em posse recalculado",
    );

    if (fisico < 0 || aSeparar < 0 || emPosse < 0) {
      throw new ErroMovimentacao(
        "ESTADO_INVALIDO",
        "O livro contém snapshots que resultam em saldo negativo.",
      );
    }
  }

  return { fisico, aSeparar, emPosse };
}

export function fisicoNaPrateleira(
  quantidade: number,
  alocacoesASeparar: readonly number[],
): number {
  validarQuantidade(quantidade, "Quantidade no estoque");
  const alocado = alocacoesASeparar.reduce(
    (total, atual) =>
      validarSoma(
        total + validarQuantidade(atual, "Quantidade A separar"),
        "Soma A separar",
      ),
    0,
  );
  return validarSoma(quantidade + alocado, "Físico na prateleira");
}
