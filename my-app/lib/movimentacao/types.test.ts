import { describe, expect, it } from "vitest";
import { ErroMovimentacao, MAX_QUANTIDADE } from "./types";
import { validarEstado, validarQuantidade } from "./validacao";

describe("validarQuantidade", () => {
  it.each([-1, 1.2, Number.MAX_SAFE_INTEGER + 1, MAX_QUANTIDADE + 1, "", null])(
    "rejeita valor inválido %j",
    (valor) => {
      expect(() => validarQuantidade(valor, "Quantidade")).toThrow(
        ErroMovimentacao,
      );
    },
  );

  it("aceita zero e inteiros dentro do limite", () => {
    expect(validarQuantidade(0, "Quantidade")).toBe(0);
    expect(validarQuantidade(MAX_QUANTIDADE, "Quantidade")).toBe(MAX_QUANTIDADE);
  });

  it("pode exigir quantidade positiva", () => {
    expect(() => validarQuantidade(0, "Quantidade", false)).toThrowError(
      expect.objectContaining({ codigo: "QUANTIDADE_INVALIDA" }),
    );
  });
});

describe("validarEstado", () => {
  it("rejeita saldos não inteiros ou negativos", () => {
    expect(() =>
      validarEstado({
        fisico: -1,
        aSeparar: 0,
        emPosse: 0,
        aSepararPorRequisicao: {},
      }),
    ).toThrowError(expect.objectContaining({ codigo: "QUANTIDADE_INVALIDA" }));
  });

  it("exige que a soma das alocações corresponda a A separar", () => {
    expect(() =>
      validarEstado({
        fisico: 0,
        aSeparar: 3,
        emPosse: 0,
        aSepararPorRequisicao: { req1: 2 },
      }),
    ).toThrowError(expect.objectContaining({ codigo: "ESTADO_INVALIDO" }));
  });
});
