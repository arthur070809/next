import { describe, expect, it } from "vitest";
import {
  cancelarRequisicao,
  confirmarSeparacao,
  debitarRequisicao,
} from "./operacoes";
import {
  fisicoNaPrateleira,
  recalcularSaldos,
} from "./recalcular-saldos";
import type {
  EstadoContaEstoque,
  LinhaMovimentoConta,
} from "./types";

const contexto = {
  itemId: "item-1",
  origem: "SISTEMA" as const,
  correlationId: "corr",
};

describe("recalcularSaldos", () => {
  it("recalcula saldos a partir dos snapshots e deltas do livro", () => {
    let estado: EstadoContaEstoque = {
      fisico: 30,
      aSeparar: 0,
      emPosse: 0,
      aSepararPorRequisicao: {},
    };
    const linhas: LinhaMovimentoConta[] = [];

    const debito = debitarRequisicao(estado, 10, {
      ...contexto,
      requisicaoId: "req-1",
    });
    linhas.push(...debito.linhas);
    estado = debito.estado;

    const confirmacao = confirmarSeparacao(estado, 6, {
      ...contexto,
      requisicaoId: "req-1",
      motivo: "Divergência de contagem",
    });
    linhas.push(...confirmacao.linhas);
    estado = confirmacao.estado;

    expect(recalcularSaldos(linhas)).toEqual({
      fisico: estado.fisico,
      aSeparar: estado.aSeparar,
      emPosse: estado.emPosse,
    });
  });

  it("retorna zero quando não há linhas", () => {
    expect(recalcularSaldos([])).toEqual({
      fisico: 0,
      aSeparar: 0,
      emPosse: 0,
    });
  });

  it("rejeita valores inválidos e saldo negativo derivado", () => {
    const invalidLine = {
      ...debitarRequisicao(
        {
          fisico: 1,
          aSeparar: 0,
          emPosse: 0,
          aSepararPorRequisicao: {},
        },
        1,
        { ...contexto, requisicaoId: "req-1" },
      ).linhas[0],
      fisicoDepois: -1,
    };
    expect(() => recalcularSaldos([invalidLine])).toThrow();
  });

  it("preserva a identidade física da prateleira", () => {
    expect(fisicoNaPrateleira(12, [3, 5, 0])).toBe(20);
    expect(() => fisicoNaPrateleira(2, [-1])).toThrow();
  });

  it("preserva a soma do livro em sequências determinísticas de operações", () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let scenario = 0; scenario < 25; scenario += 1) {
      let estado: EstadoContaEstoque = {
        fisico: 200,
        aSeparar: 0,
        emPosse: 0,
        aSepararPorRequisicao: {},
      };
      const linhas: LinhaMovimentoConta[] = [];

      for (let operation = 0; operation < 12; operation += 1) {
        const requisicaoId = `req-${scenario}-${operation}`;
        const contextoRequisicao = { ...contexto, requisicaoId };
        const pedido = 1 + Math.floor(random() * 5);
        const debito = debitarRequisicao(estado, pedido, contextoRequisicao);
        estado = debito.estado;
        linhas.push(...debito.linhas);

        if (random() < 0.5) {
          const cancelamento = cancelarRequisicao(estado, contextoRequisicao);
          estado = cancelamento.estado;
          linhas.push(...cancelamento.linhas);
        } else {
          const real = Math.floor(random() * (pedido + 1));
          const confirmacao = confirmarSeparacao(estado, real, {
            ...contextoRequisicao,
            motivo: real < pedido ? "Diferença simulada" : null,
          });
          estado = confirmacao.estado;
          linhas.push(...confirmacao.linhas);
        }

        expect(recalcularSaldos(linhas)).toEqual({
          fisico: estado.fisico,
          aSeparar: estado.aSeparar,
          emPosse: estado.emPosse,
        });
      }
    }
  });
});
