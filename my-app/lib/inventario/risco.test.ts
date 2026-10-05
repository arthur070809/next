import { describe, expect, it } from "vitest";
import { pontuarRisco, selecionarParaContagem } from "./risco";

const item = { id: "item-1", codigo: "A-1", saldo: 4, pontoReposicao: 10 };
const contexto = {
  movimentacoesRecentes: 3,
  divergenciasRecentes: 1,
  diasDesdeUltimaContagem: 30,
};

describe("risco e seleção para contagem cega", () => {
  it("não reduz a pontuação quando aumenta o movimento recente", () => {
    const baixo = pontuarRisco(item, { ...contexto, movimentacoesRecentes: 2 });
    const alto = pontuarRisco(item, { ...contexto, movimentacoesRecentes: 8 });
    expect(alto).toBeGreaterThanOrEqual(baixo);
  });

  it("limita a seleção por viagem e prioriza o maior risco", () => {
    const selecionados = selecionarParaContagem([
      { id: "1", codigo: "A", risco: 10 },
      { id: "2", codigo: "B", risco: 90 },
      { id: "3", codigo: "C", risco: 40 },
      { id: "4", codigo: "D", risco: 70 },
    ]);
    expect(selecionados.map(({ id }) => id)).toEqual(["2", "4", "3"]);
    expect(selecionados).toHaveLength(3);
  });

  it("desempata por código e elimina ids repetidos", () => {
    expect(selecionarParaContagem([
      { id: "b", codigo: "B-2", risco: 80 },
      { id: "c", codigo: "A-2", risco: 80 },
      { id: "a", codigo: "A-2", risco: 80 },
      { id: "a", codigo: "A-1", risco: 90 },
    ], 3)).toEqual([
      { id: "a", codigo: "A-1", risco: 90 },
      { id: "c", codigo: "A-2", risco: 80 },
      { id: "b", codigo: "B-2", risco: 80 },
    ]);
  });

  it("devolve no máximo o limite e nunca repete ids em entradas arbitrárias", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const itens = Array.from({ length: seed }, (_, index) => ({
        id: `id-${index % Math.max(1, Math.ceil(seed / 2))}`,
        codigo: `COD-${index}`,
        risco: (seed * (index + 7)) % 101,
      }));
      const limite = seed % 5;
      const selecionados = selecionarParaContagem(itens, limite);
      expect(selecionados.length).toBeLessThanOrEqual(limite);
      expect(new Set(selecionados.map(({ id }) => id)).size).toBe(selecionados.length);
    }
  });

  it("rejeita limites e pontuações inválidos", () => {
    expect(() => selecionarParaContagem([], -1)).toThrow(RangeError);
    expect(() => selecionarParaContagem([{ id: "x", codigo: "X", risco: 101 }])).toThrow(RangeError);
    expect(() => pontuarRisco(item, { ...contexto, movimentacoesRecentes: 1.5 })).toThrow(RangeError);
  });
});
