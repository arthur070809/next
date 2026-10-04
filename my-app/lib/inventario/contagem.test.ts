import { describe, expect, it } from "vitest";
import { avaliarContagem, indiceAcuracia } from "./contagem";

describe("avaliação cega de contagem", () => {
  it("classifica contagem igual ao esperado", () => {
    expect(avaliarContagem({ esperado: 12, contado: 12, tolerancia: 1 })).toEqual({
      resultado: "BATEU",
      diferenca: 0,
      percentualDiferenca: 0,
      acaoSugerida: "CONFIRMAR",
    });
  });

  it("confirma uma diferença dentro da tolerância", () => {
    const avaliacao = avaliarContagem({ esperado: 12, contado: 13, tolerancia: 1 });
    expect(avaliacao).toMatchObject({
      resultado: "DENTRO_TOLERANCIA",
      diferenca: 1,
      acaoSugerida: "CONFIRMAR",
    });
    expect(avaliacao.percentualDiferenca).toBeCloseTo(100 / 12);
  });

  it("sugere recontagem quando a diferença excede a tolerância", () => {
    expect(avaliarContagem({ esperado: 12, contado: 15, tolerancia: 1 })).toMatchObject({
      resultado: "DIVERGENTE",
      diferenca: 3,
      percentualDiferenca: 25,
      acaoSugerida: "RECONTAR",
    });
  });

  it("trata esperado zero sem divisão por zero ou NaN", () => {
    expect(avaliarContagem({ esperado: 0, contado: 0, tolerancia: 0 })).toMatchObject({
      resultado: "BATEU",
      diferenca: 0,
      percentualDiferenca: 0,
    });
    expect(avaliarContagem({ esperado: 0, contado: 2, tolerancia: 0 })).toMatchObject({
      resultado: "DIVERGENTE",
      diferenca: 2,
      percentualDiferenca: null,
    });
  });

  it("calcula índice por local e devolve lista vazia sem contagens", () => {
    expect(indiceAcuracia([])).toEqual([]);
    expect(indiceAcuracia([
      { localId: "local-b", resultado: "DIVERGENTE" },
      { localId: "local-a", resultado: "BATEU" },
      { localId: "local-a", resultado: "DENTRO_TOLERANCIA" },
      { localId: "local-a", resultado: "DIVERGENTE" },
    ])).toEqual([
      { localId: "local-a", total: 3, dentroDoEsperado: 2, percentual: 66.67 },
      { localId: "local-b", total: 1, dentroDoEsperado: 0, percentual: 0 },
    ]);
  });

  it("rejeita valores negativos, decimais, não finitos e acima do limite", () => {
    expect(() => avaliarContagem({ esperado: -1, contado: 0, tolerancia: 0 })).toThrow(RangeError);
    expect(() => avaliarContagem({ esperado: 1.5, contado: 0, tolerancia: 0 })).toThrow(RangeError);
    expect(() => avaliarContagem({ esperado: Number.NaN, contado: 0, tolerancia: 0 })).toThrow(RangeError);
    expect(() => avaliarContagem({ esperado: 0, contado: 0, tolerancia: 2_147_483_648 })).toThrow(RangeError);
  });
});
