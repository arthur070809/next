import { describe, expect, it } from "vitest";
import {
  cancelarRequisicao,
  confirmarSeparacao,
  debitarRequisicao,
  type ContextoMovimento,
} from "./operacoes";
import type { EstadoContaEstoque } from "./types";

const contexto: ContextoMovimento = {
  itemId: "item-1",
  requisicaoId: "req-1",
  origem: "QR",
  correlationId: "corr-1",
};

const saldoInicial: EstadoContaEstoque = {
  fisico: 10,
  aSeparar: 0,
  emPosse: 2,
  aSepararPorRequisicao: {},
};

describe("debitarRequisicao", () => {
  it("debita o físico e aloca a quantidade para a requisição", () => {
    const result = debitarRequisicao(saldoInicial, 4, contexto);

    expect(result.estado).toEqual({
      fisico: 6,
      aSeparar: 4,
      emPosse: 2,
      aSepararPorRequisicao: { "req-1": 4 },
    });
    expect(result.linhas[0]).toMatchObject({
      tipo: "REQUISICAO_DEBITO",
      quantidade: 4,
      fisicoAntes: 10,
      fisicoDepois: 6,
      aSepararAntes: 0,
      aSepararDepois: 4,
      emPosseAntes: 2,
      emPosseDepois: 2,
      idempotencyKey: "REQUISICAO_DEBITO:req-1:item-1",
      origem: "QR",
    });
    expect(saldoInicial.fisico).toBe(10);
  });

  it("falha com SALDO_INSUFICIENTE e inclui o livre atual", () => {
    expect(() => debitarRequisicao(saldoInicial, 11, contexto)).toThrowError(
      expect.objectContaining({
        codigo: "SALDO_INSUFICIENTE",
        livreAtual: 10,
      }),
    );
  });

  it("debita quando o pedido é exatamente igual ao físico", () => {
    const result = debitarRequisicao(saldoInicial, saldoInicial.fisico, contexto);

    expect(result.estado).toEqual({
      fisico: 0,
      aSeparar: saldoInicial.fisico,
      emPosse: saldoInicial.emPosse,
      aSepararPorRequisicao: { "req-1": saldoInicial.fisico },
    });
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({
      tipo: "REQUISICAO_DEBITO",
      quantidade: saldoInicial.fisico,
      fisicoAntes: 10,
      fisicoDepois: 0,
      aSepararAntes: 0,
      aSepararDepois: 10,
      emPosseAntes: 2,
      emPosseDepois: 2,
    });
  });
});

describe("confirmarSeparacao", () => {
  const alocado = debitarRequisicao(saldoInicial, 4, contexto).estado;

  it("confirma a quantidade pedida sem debitar o físico novamente", () => {
    const result = confirmarSeparacao(alocado, 4, contexto);
    expect(result.estado).toEqual({
      fisico: 6,
      aSeparar: 0,
      emPosse: 6,
      aSepararPorRequisicao: { "req-1": 0 },
    });
    expect(result.linhas.map(({ tipo }) => tipo)).toEqual([
      "SEPARACAO_CONFIRMADA",
      "ENTREGA",
    ]);
  });

  it("devolve a diferença ao físico com motivo obrigatório", () => {
    const result = confirmarSeparacao(alocado, 2, {
      ...contexto,
      motivo: "Faltaram duas unidades na prateleira",
    });
    expect(result.estado).toEqual({
      fisico: 8,
      aSeparar: 0,
      emPosse: 4,
      aSepararPorRequisicao: { "req-1": 0 },
    });
    expect(result.linhas[0]).toMatchObject({
      tipo: "SEPARACAO_CONFIRMADA",
      quantidade: 4,
      motivo: "Faltaram duas unidades na prateleira",
      fisicoAntes: 6,
      fisicoDepois: 8,
      aSepararAntes: 4,
      aSepararDepois: 0,
    });
  });

  it("rejeita uma diferença sem motivo", () => {
    expect(() => confirmarSeparacao(alocado, 2, contexto)).toThrowError(
      expect.objectContaining({ codigo: "MOTIVO_OBRIGATORIO" }),
    );
  });

  it("rejeita quantidade maior que a alocada", () => {
    expect(() => confirmarSeparacao(alocado, 5, contexto)).toThrowError(
      expect.objectContaining({ codigo: "QUANTIDADE_ACIMA_DO_PEDIDO" }),
    );
  });

  it("não cria entrega com quantidade zero e devolve toda a alocação", () => {
    const result = confirmarSeparacao(alocado, 0, {
      ...contexto,
      motivo: "Nenhuma unidade encontrada",
    });
    expect(result.estado).toMatchObject({
      fisico: 10,
      aSeparar: 0,
      emPosse: 2,
    });
    expect(result.linhas).toHaveLength(1);
  });

  it("não permite confirmar duas vezes a mesma alocação", () => {
    const first = confirmarSeparacao(alocado, 4, contexto);
    const linhasGeradas = [...first.linhas];
    const linhasAntesDaSegundaChamada = linhasGeradas.length;

    expect(() => confirmarSeparacao(first.estado, 4, contexto)).toThrowError(
      expect.objectContaining({ codigo: "ALOCACAO_INSUFICIENTE" }),
    );
    expect(linhasGeradas).toHaveLength(linhasAntesDaSegundaChamada);
  });
});

describe("cancelarRequisicao", () => {
  it("devolve somente A separar e mantém Em posse intacto", () => {
    const alocado = debitarRequisicao(saldoInicial, 4, contexto).estado;
    const comOutraAlocacao: EstadoContaEstoque = {
      ...alocado,
      fisico: 3,
      aSeparar: 7,
      emPosse: 8,
      aSepararPorRequisicao: { "req-1": 4, "req-2": 3 },
    };

    const result = cancelarRequisicao(comOutraAlocacao, contexto);
    expect(result.estado).toEqual({
      fisico: 7,
      aSeparar: 3,
      emPosse: 8,
      aSepararPorRequisicao: { "req-1": 0, "req-2": 3 },
    });
    expect(result.linhas[0]).toMatchObject({
      tipo: "CANCELAMENTO_DEVOLUCAO",
      quantidade: 4,
      emPosseAntes: 8,
      emPosseDepois: 8,
    });
  });

  it("é idempotente quando a alocação da requisição já foi devolvida", () => {
    const alocado = debitarRequisicao(saldoInicial, 4, contexto).estado;
    const first = cancelarRequisicao(alocado, contexto);
    const second = cancelarRequisicao(first.estado, contexto);

    expect(first.linhas).toHaveLength(1);
    expect(first.linhas[0]).toMatchObject({
      tipo: "CANCELAMENTO_DEVOLUCAO",
      idempotencyKey: "CANCELAMENTO_DEVOLUCAO:req-1:item-1",
    });
    expect(second.estado).toEqual(first.estado);
    expect(second.linhas).toEqual([]);
  });

  it("não devolve novamente saldo após separação parcial", () => {
    const alocado = debitarRequisicao(saldoInicial, 4, contexto).estado;
    const separadoParcialmente = confirmarSeparacao(alocado, 2, {
      ...contexto,
      motivo: "Duas unidades não foram encontradas",
    });
    const antesDoCancelamento = separadoParcialmente.estado;
    const cancelamento = cancelarRequisicao(antesDoCancelamento, contexto);

    expect(cancelamento.linhas).toEqual([]);
    expect(cancelamento.estado).toEqual(antesDoCancelamento);
    expect(cancelamento.estado.fisico).toBe(8);
    expect(cancelamento.estado.emPosse).toBe(4);
  });
});
