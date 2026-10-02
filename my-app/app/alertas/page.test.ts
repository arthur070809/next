import { describe, expect, it } from "vitest";
import type { Alerta } from "./page";
import { calcularNivelUrgencia, filtrarAlertasVisiveis } from "./page";

describe("alertas page business logic", () => {
  it("classifies the urgency according to how far the stock is from the reorder point", () => {
    expect(calcularNivelUrgencia({ estoqueAtual: 2, pontoReposicao: 10 }).nivel).toBe("Crítico");
    expect(calcularNivelUrgencia({ estoqueAtual: 5, pontoReposicao: 10 }).nivel).toBe("Atenção");
    expect(calcularNivelUrgencia({ estoqueAtual: 11, pontoReposicao: 10 }).nivel).toBe("Baixo");
  });

  it("hides alerts that have already recovered above the reorder point", () => {
    const alerts: Alerta[] = [
      { id: "a1", itemNome: "Parafuso", almoxarifado: "central", estoqueAtual: 3, pontoReposicao: 10, status: "ativo", criadoEm: "2026-10-01T09:00:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
      { id: "a2", itemNome: "Porca", almoxarifado: "embalagens", estoqueAtual: 12, pontoReposicao: 10, status: "ativo", criadoEm: "2026-10-01T10:00:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
      { id: "a3", itemNome: "Chapa", almoxarifado: "materia-prima", estoqueAtual: 6, pontoReposicao: 10, status: "em_providencia", criadoEm: "2026-10-01T11:00:00.000Z", marcadoProvidenciaPor: "ADM-101", marcadoProvidenciaEm: "2026-10-01T11:20:00.000Z" },
    ];

    expect(filtrarAlertasVisiveis(alerts, "todos")).toEqual([alerts[0], alerts[2]]);
    expect(filtrarAlertasVisiveis(alerts, "embalagens")).toEqual([]);
  });
});
