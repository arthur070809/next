import { describe, expect, it } from "vitest";
import { planejarViagens } from "./planejar-viagens";
import { locaisDemonstracao, requisicoesDemonstracao } from "./demo-data";

describe("dados de demonstração de viagens", () => {
  it("alimenta o planejador real e fixa uma economia de 12 idas para 3 viagens", () => {
    const plano = planejarViagens(requisicoesDemonstracao);

    expect(locaisDemonstracao.map(({ nome }) => nome)).toEqual([
      "Consumíveis",
      "Matéria-prima",
      "Componentes",
      "Embalagens",
    ]);
    expect(requisicoesDemonstracao).toHaveLength(6);
    expect(requisicoesDemonstracao.every(({ itens }) => itens.length >= 2 && itens.length <= 4)).toBe(true);
    expect(plano.metricas).toEqual({
      idasSemAgrupar: 12,
      idasAgrupadas: 3,
      idasEconomizadas: 9,
    });
  });
});
