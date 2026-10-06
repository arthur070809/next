import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { finalizarItemComQuantidade } from "./requisicoes-db";
import {
  StatusItemRequisicao,
  TipoMovimentacao,
} from "@/generated/prisma/client";

const transaction = {
  $executeRaw: vi.fn(),
  requisicaoItem: { findUnique: vi.fn(), update: vi.fn() },
  saldoEstoque: { findUnique: vi.fn() },
  movimentacao: { create: vi.fn() },
};

describe("quantity-aware requisition finalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.requisicaoItem.findUnique.mockResolvedValue({
      id: "request-item-1",
      itemId: "item-1",
      localId: "location-1",
      requisicaoId: "request-1",
      quantidade: 5,
      status: StatusItemRequisicao.ASSUMIDO,
    });
    transaction.$executeRaw.mockResolvedValue(1);
    transaction.saldoEstoque.findUnique.mockResolvedValue({
      id: "balance-1",
      quantidade: 7,
      reservada: 0,
    });
    transaction.movimentacao.create.mockResolvedValue({
      id: "movement-1",
      tipo: TipoMovimentacao.SAIDA,
      quantidade: 3,
    });
    transaction.requisicaoItem.update.mockResolvedValue({});
  });

  it("records only the actually separated quantity and releases the full reservation", async () => {
    const result = await finalizarItemComQuantidade({
      requisicaoItemId: "request-item-1",
      quantidadeSeparada: 3,
      motivo: "FALTOU",
      funcionarioId: 8,
      tx: transaction as never,
    });

    expect(result).toMatchObject({
      quantidadePedida: 5,
      quantidadeSeparada: 3,
      motivo: "FALTOU",
      movimentacao: { tipo: TipoMovimentacao.SAIDA, quantidade: 3 },
    });
    expect(transaction.requisicaoItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: StatusItemRequisicao.SEPARADO,
        motivoNaoAtendido: "FALTOU",
      }),
    }));
  });

  it("releases the reservation without an outgoing movement when nothing was separated", async () => {
    transaction.movimentacao.create.mockResolvedValue({
      id: "movement-1",
      tipo: TipoMovimentacao.LIBERACAO_RESERVA,
      quantidade: 5,
    });

    const result = await finalizarItemComQuantidade({
      requisicaoItemId: "request-item-1",
      quantidadeSeparada: 0,
      motivo: "AVARIA",
      funcionarioId: 8,
      tx: transaction as never,
    });

    expect(result.movimentacao).toMatchObject({
      tipo: TipoMovimentacao.LIBERACAO_RESERVA,
      quantidade: 5,
    });
    expect(transaction.requisicaoItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: StatusItemRequisicao.NAO_SEPARADO, separado: false }),
    }));
  });

  it("rejects a concurrent stock change without creating a movement", async () => {
    transaction.$executeRaw.mockResolvedValue(0);

    await expect(finalizarItemComQuantidade({
      requisicaoItemId: "request-item-1",
      quantidadeSeparada: 3,
      motivo: "FALTOU",
      funcionarioId: 8,
      tx: transaction as never,
    })).rejects.toMatchObject({ code: "SALDO_INSUFICIENTE" });
    expect(transaction.movimentacao.create).not.toHaveBeenCalled();
  });
});
