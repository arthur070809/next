import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    funcionario: { findFirst: vi.fn() },
    requisicao: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    requisicaoItem: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    saldoEstoque: { findUnique: vi.fn() },
    movimentacao: { create: vi.fn() },
    auditoria: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { GET, PATCH } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PapelFuncionario,
  StatusItemRequisicao,
  StatusRequisicao,
  TipoMovimentacao,
} from "@/generated/prisma/client";

const stockkeeper = { id: 8, papel: PapelFuncionario.ALMOXARIFE };

function claimRequest(codigoCracha = "2222") {
  return new Request("http://localhost/api/almoxarifado/requisicoes/REQ-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ action: "assumir", codigoCracha }),
  });
}

function context(numeroPedido = "REQ-1") {
  return { params: Promise.resolve({ numeroPedido }) };
}

function finalizeRequest(itens: Array<{ id: string; quantidadeSeparada: number; motivo?: string }>) {
  return new Request("http://localhost/api/almoxarifado/requisicoes/REQ-1", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ action: "finalizar", itens }),
  });
}

describe("atomic request claiming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(stockkeeper as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      ((callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma)) as never,
    );
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({
      id: stockkeeper.id,
      nome: "Almoxarife",
      papel: stockkeeper.papel,
    } as never);
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.requisicaoItem.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.auditoria.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
    vi.mocked(prisma.requisicaoItem.findUnique).mockResolvedValue({
      id: "req-item-1",
      itemId: "item-1",
      localId: "local-1",
      requisicaoId: "req-id-1",
      quantidade: 5,
      status: StatusItemRequisicao.ASSUMIDO,
    } as never);
    vi.mocked(prisma.requisicaoItem.update).mockResolvedValue({} as never);
    vi.mocked(prisma.requisicao.update).mockResolvedValue({} as never);
    vi.mocked(prisma.saldoEstoque.findUnique).mockResolvedValue({
      id: "saldo-1",
      quantidade: 10,
      reservada: 0,
    } as never);
    vi.mocked(prisma.movimentacao.create).mockResolvedValue({
      id: "movement-1",
      tipo: TipoMovimentacao.SAIDA,
      quantidade: 3,
    } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue(null as never);
  });

  describe("checklist request details", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(stockkeeper as never);
      vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
        numeroPedido: "REQ-1",
        status: StatusRequisicao.ASSUMIDA,
        prioridade: "PRIORITARIO",
        criadoEm: new Date("2026-10-01T12:00:00Z"),
        solicitante: { nome: "Operador" },
        atendente: { id: stockkeeper.id, nome: "Almoxarife" },
        itens: [{
          id: "req-item-1",
          itemId: "item-1",
          unidadeMedida: "UN",
          quantidade: 2,
          descricao: "[[setor:v1:setor2]]\nMontagem na linha",
          status: StatusItemRequisicao.ASSUMIDO,
          item: { id: "item-1", nome: "Arruela", codigo: "129", unidade: "UN" },
        }],
      } as never);
      vi.mocked(prisma.auditoria.findMany).mockResolvedValue([] as never);
    });

    it("returns decoded item description without metadata markers", async () => {
      const response = await GET(new Request("http://localhost"), context());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.requisicao.itens[0].descricao).toBe("Montagem na linha");
      expect(body.requisicao.itens[0].setor).toBe("setor2");
      expect(JSON.stringify(body)).not.toContain("[[setor:");
    });

    it("falls back to the legacy request observation when the item has no description", async () => {
      vi.mocked(prisma.requisicao.findUnique).mockResolvedValueOnce({
        numeroPedido: "REQ-1",
        observacao: "Descrição antiga do pedido",
        status: StatusRequisicao.ASSUMIDA,
        prioridade: "PADRAO",
        criadoEm: new Date("2026-10-01T12:00:00Z"),
        solicitante: { nome: "Operador" },
        atendente: { id: stockkeeper.id, nome: "Almoxarife" },
        itens: [{
          id: "req-item-1",
          itemId: "item-1",
          unidadeMedida: "UN",
          quantidade: 2,
          descricao: null,
          status: StatusItemRequisicao.ASSUMIDO,
          item: { id: "item-1", nome: "Arruela", codigo: "129", unidade: "UN" },
        }],
      } as never);

      const response = await GET(new Request("http://localhost"), context());
      const body = await response.json();

      expect(body.requisicao.itens[0].descricao).toBe("Descrição antiga do pedido");
    });
  });

  it("claims a pending request through a conditional status update", async () => {
    const response = await PATCH(claimRequest(), context());

    expect(response.status).toBe(200);
    expect(prisma.requisicao.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { numeroPedido: "REQ-1", status: StatusRequisicao.PENDENTE },
      data: expect.objectContaining({ status: StatusRequisicao.ASSUMIDA, atendenteId: stockkeeper.id }),
    }));
    expect(prisma.auditoria.create).toHaveBeenCalledTimes(1);
  });

  it("returns the winner name when a concurrent claim already changed the status", async () => {
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      status: StatusRequisicao.ASSUMIDA,
      atendente: { nome: "Outro almoxarife" },
    } as never);

    const response = await PATCH(claimRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("Outro almoxarife");
    expect(prisma.requisicaoItem.updateMany).not.toHaveBeenCalled();
  });

  it("blocks an operator before attempting the conditional update", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 9,
      papel: PapelFuncionario.OPERADOR,
    } as never);

    const response = await PATCH(claimRequest(), context());

    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.requisicao.updateMany).not.toHaveBeenCalled();
  });

  it("returns not found when no request exists", async () => {
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue(null as never);

    const response = await PATCH(claimRequest(), context("REQ-MISSING"));

    expect(response.status).toBe(404);
  });

  it("finalizes a partially fulfilled item and returns the stock movement summary", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "req-id-1",
      numeroPedido: "REQ-1",
      status: StatusRequisicao.ASSUMIDA,
      atendenteId: stockkeeper.id,
      itens: [{
        id: "req-item-1",
        quantidade: 5,
        unidadeMedida: "UN",
        status: StatusItemRequisicao.ASSUMIDO,
        item: { nome: "Arruela" },
      }],
    } as never);

    const response = await PATCH(finalizeRequest([
      { id: "req-item-1", quantidadeSeparada: 3, motivo: "FALTOU" },
    ]), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resumo.itens).toEqual([{
      id: "req-item-1",
      nome: "Arruela",
      quantidadePedida: 5,
      quantidadeSeparada: 3,
      unidadeMedida: "UN",
      motivo: "FALTOU",
    }]);
    expect(body.resumo.movimentacoes).toEqual([{
      id: "movement-1",
      tipo: TipoMovimentacao.SAIDA,
      quantidade: 3,
      unidadeMedida: "UN",
    }]);
    expect(prisma.movimentacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: TipoMovimentacao.SAIDA, quantidade: 3 }),
    }));
  });

  it("releases the reservation and records an avaria when zero units are separated", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "req-id-1",
      numeroPedido: "REQ-1",
      status: StatusRequisicao.ASSUMIDA,
      atendenteId: stockkeeper.id,
      itens: [{
        id: "req-item-1",
        quantidade: 5,
        unidadeMedida: "UN",
        status: StatusItemRequisicao.ASSUMIDO,
        item: { nome: "Arruela" },
      }],
    } as never);
    vi.mocked(prisma.movimentacao.create).mockResolvedValue({
      id: "movement-1",
      tipo: TipoMovimentacao.LIBERACAO_RESERVA,
      quantidade: 5,
    } as never);

    const response = await PATCH(finalizeRequest([
      { id: "req-item-1", quantidadeSeparada: 0, motivo: "AVARIA" },
    ]), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resumo.movimentacoes[0]).toMatchObject({
      tipo: TipoMovimentacao.LIBERACAO_RESERVA,
      quantidade: 5,
      unidadeMedida: "UN",
    });
    expect(prisma.requisicaoItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: StatusItemRequisicao.NAO_SEPARADO,
        separado: false,
        motivoNaoAtendido: "AVARIA",
      }),
    }));
  });

  it("does not allow another stockkeeper to finalize the assigned request", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "req-id-1",
      numeroPedido: "REQ-1",
      status: StatusRequisicao.ASSUMIDA,
      atendenteId: 99,
      itens: [{
        id: "req-item-1",
        quantidade: 5,
        unidadeMedida: "UN",
        status: StatusItemRequisicao.ASSUMIDO,
        item: { nome: "Arruela" },
      }],
    } as never);

    const response = await PATCH(finalizeRequest([
      { id: "req-item-1", quantidadeSeparada: 5 },
    ]), context());

    expect(response.status).toBe(403);
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
    expect(prisma.requisicaoItem.update).not.toHaveBeenCalled();
  });

  it("requires a supported reason for a quantity divergence", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "req-id-1",
      numeroPedido: "REQ-1",
      status: StatusRequisicao.ASSUMIDA,
      atendenteId: stockkeeper.id,
      itens: [{
        id: "req-item-1",
        quantidade: 5,
        status: StatusItemRequisicao.ASSUMIDO,
        item: { nome: "Arruela" },
      }],
    } as never);

    const response = await PATCH(finalizeRequest([
      { id: "req-item-1", quantidadeSeparada: 3, motivo: "EXCEDEU_LOTE_MINIMO" },
    ]), context());

    expect(response.status).toBe(400);
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
  });

  it("rejects malformed checklist outcomes without a server error", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "req-id-1",
      numeroPedido: "REQ-1",
      status: StatusRequisicao.ASSUMIDA,
      atendenteId: stockkeeper.id,
      itens: [{
        id: "req-item-1",
        quantidade: 5,
        unidadeMedida: "UN",
        status: StatusItemRequisicao.ASSUMIDO,
        item: { nome: "Arruela" },
      }],
    } as never);

    const response = await PATCH(new Request("http://localhost/api/almoxarifado/requisicoes/REQ-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ action: "finalizar", itens: [null] }),
    }), context());

    expect(response.status).toBe(400);
    expect(prisma.movimentacao.create).not.toHaveBeenCalled();
  });
});
