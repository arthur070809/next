import { describe, expect, it } from "vitest";
import {
  classificar,
  calcularQuantidadeRessuprimento,
  consumoMedioDiario,
  diasDeCobertura,
  historicoRealSuficiente,
  MARGEM_SEGURANCA_DIAS,
  PRAZO_REPOSICAO_PADRAO_DIAS,
  pontoSugerido,
  ordenarPorDeficitRessuprimento,
  sugestao,
} from "./analise";

const hoje = new Date("2026-10-04T12:00:00.000Z");

describe("núcleo de ressuprimento", () => {
  it("retorna null para janela sem saídas", () => {
    expect(consumoMedioDiario([], 30, hoje)).toBeNull();
  });

  it("calcula consumo por dia corrido na janela e ignora movimentos fora da janela", () => {
    expect(consumoMedioDiario([
      { tipo: "SAIDA", quantidade: 30, criadoEm: "2026-10-01T10:00:00.000Z" },
      { tipo: "ENTRADA", quantidade: 900, criadoEm: "2026-10-02T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: 300, criadoEm: "2026-08-01T10:00:00.000Z" },
    ], 30, hoje)).toBe(1);
  });

  it("descarta quantidades inválidas e datas inválidas", () => {
    expect(consumoMedioDiario([
      { tipo: "SAIDA", quantidade: 10, criadoEm: "2026-10-03T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: -1, criadoEm: "2026-10-03T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: 1.5, criadoEm: "2026-10-03T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: 0, criadoEm: "2026-10-03T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: Number.MAX_SAFE_INTEGER, criadoEm: "2026-10-03T10:00:00.000Z" },
      { tipo: "SAIDA", quantidade: 3, criadoEm: "não é data" },
    ], 30, hoje)).toBe(10 / 30);
    expect(consumoMedioDiario([
      { tipo: "SAIDA", quantidade: -1, criadoEm: "2026-10-03T10:00:00.000Z" },
    ], 30, hoje)).toBeNull();
  });

  it("trata consumo zero como cobertura infinita sem dividir por zero", () => {
    expect(diasDeCobertura(20, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(diasDeCobertura(20, null)).toBe(Number.POSITIVE_INFINITY);
  });

  it("arredonda para cima o ponto de ressuprimento", () => {
    expect(pontoSugerido(1.01, PRAZO_REPOSICAO_PADRAO_DIAS, MARGEM_SEGURANCA_DIAS)).toBe(10);
  });

  it("calculates a bounded restock quantity from current, minimum, and optional maximum", () => {
    expect(calcularQuantidadeRessuprimento(3, 5, 10)).toBe(7);
    expect(calcularQuantidadeRessuprimento(3, 5)).toBe(2);
    expect(calcularQuantidadeRessuprimento(8, 5, 10)).toBe(0);
    expect(calcularQuantidadeRessuprimento(12, 5, 10)).toBe(0);
    expect(calcularQuantidadeRessuprimento(0, null, 10)).toBeNull();
    expect(calcularQuantidadeRessuprimento(0, undefined, undefined)).toBeNull();
    expect(calcularQuantidadeRessuprimento(0, 0, 10)).toBeNull();
  });

  it("rejects negative stock quantities and invalid maximum thresholds", () => {
    expect(() => calcularQuantidadeRessuprimento(-1, 5, 10)).toThrow(RangeError);
    expect(() => calcularQuantidadeRessuprimento(1, 5, -1)).toThrow(RangeError);
    expect(() => calcularQuantidadeRessuprimento(1, null, -1)).toThrow(RangeError);
    expect(() => calcularQuantidadeRessuprimento(1, -1, 5)).toThrow(RangeError);
    expect(() => calcularQuantidadeRessuprimento(1, 10, 5)).toThrow(RangeError);
  });

  it("sorts the largest configured-minimum deficit first with stable id tie-breaking", () => {
    const items = [
      { id: "b", nome: "Tie B", estoque: 2, pontoAtual: 5 },
      { id: "d", nome: "No point", estoque: 0, pontoAtual: null },
      { id: "a", nome: "Tie A", estoque: 1, pontoAtual: 4 },
      { id: "c", nome: "Largest deficit", estoque: 1, pontoAtual: 8 },
    ];
    expect(ordenarPorDeficitRessuprimento(items).map(({ id }) => id)).toEqual(["c", "a", "b", "d"]);
    expect(ordenarPorDeficitRessuprimento([])).toEqual([]);
  });

  it("classifica os limites do prazo e do dobro do prazo", () => {
    expect(classificar(PRAZO_REPOSICAO_PADRAO_DIAS - 0.01)).toBe("VERMELHO");
    expect(classificar(PRAZO_REPOSICAO_PADRAO_DIAS)).toBe("AMARELO");
    expect(classificar(PRAZO_REPOSICAO_PADRAO_DIAS * 2)).toBe("AMARELO");
    expect(classificar(PRAZO_REPOSICAO_PADRAO_DIAS * 2 + 0.01)).toBe("VERDE");
    expect(classificar(null)).toBe("SEM_DADOS");
  });

  it("marca baixa confiança com pouco histórico", () => {
    expect(sugestao({
      id: "item-1",
      nome: "Item fictício",
      estoque: 12,
      pontoAtual: 2,
      movimentosSaida: [
        { tipo: "SAIDA", quantidade: 2, criadoEm: "2026-10-03T10:00:00.000Z" },
      ],
    }, undefined, undefined, hoje).confianca).toBe("BAIXA");
  });

  it("considera suficiente apenas histórico com cinco saídas e sete dias de alcance", () => {
    const movimentos = Array.from({ length: 5 }, (_, index) => ({
      tipo: "SAIDA",
      quantidade: 1,
      criadoEm: new Date(Date.UTC(2026, 8, 27 + index, 12)).toISOString(),
    }));
    expect(historicoRealSuficiente(movimentos, hoje, 30)).toBe(true);
    expect(historicoRealSuficiente(movimentos.slice(0, 4), hoje, 30)).toBe(false);
    expect(historicoRealSuficiente(
      Array.from({ length: 5 }, (_, index) => ({
        tipo: "SAIDA",
        quantidade: 1,
        criadoEm: new Date(Date.UTC(2026, 9, 2 + (index % 3), 12)).toISOString(),
      })),
      hoje,
      30,
    )).toBe(false);
  });
});
