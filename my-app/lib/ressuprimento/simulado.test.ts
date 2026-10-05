import { describe, expect, it } from "vitest";
import { gerarMovimentosSimulados } from "./simulado";

describe("gerarMovimentosSimulados", () => {
  it("produz o mesmo histórico para a mesma semente e data", () => {
    const hoje = new Date("2026-10-04T12:00:00.000Z");
    expect(gerarMovimentosSimulados("item-ficticio", hoje)).toEqual(
      gerarMovimentosSimulados("item-ficticio", hoje),
    );
  });

  it("inclui um pico de consumo concentrado em uma semana", () => {
    const movimentos = gerarMovimentosSimulados(
      "item-ficticio",
      new Date("2026-10-04T12:00:00.000Z"),
    );
    const semanaPico = movimentos
      .filter(({ criadoEm }) => {
        const data = new Date(criadoEm);
        return data >= new Date("2026-09-25T00:00:00.000Z") &&
          data < new Date("2026-10-02T00:00:00.000Z");
      })
      .reduce((soma, movimento) => soma + movimento.quantidade, 0);
    const demaisDias = movimentos
      .filter(({ criadoEm }) => {
        const data = new Date(criadoEm);
        return data < new Date("2026-09-25T00:00:00.000Z") ||
          data >= new Date("2026-10-02T00:00:00.000Z");
      })
      .reduce((soma, movimento) => soma + movimento.quantidade, 0);

    expect(semanaPico).toBeGreaterThan(demaisDias / 2);
  });
});
