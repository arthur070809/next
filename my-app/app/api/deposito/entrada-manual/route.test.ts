import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  movimentacao: { findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  item: { findUnique: vi.fn() },
  requisicao: { findUnique: vi.fn() },
  localEstoque: { upsert: vi.fn(), findUnique: vi.fn() },
  saldoEstoque: { upsert: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/auth", () => ({ requireAlmoxarife: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANUAL_DEPOSIT_REASONS } from "@/lib/deposito-constants";

const key = "10000000-0000-4000-8000-000000000001";

function request(body: Record<string, unknown>, idempotencyKey = key) {
  return new Request("http://localhost/api/deposito/entrada-manual", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/deposito/entrada-manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAlmoxarife).mockResolvedValue({
      funcionario: { id: 27, papel: "ALMOXARIFE" },
      status: 200,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      ((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) as never,
    );
    transaction.movimentacao.findUnique.mockResolvedValue(null);
    transaction.movimentacao.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    transaction.movimentacao.create.mockResolvedValue({});
    transaction.item.findUnique.mockResolvedValue({ id: "item-1", ativo: true });
    transaction.requisicao.findUnique.mockResolvedValue(null);
    transaction.localEstoque.upsert.mockResolvedValue({ id: "deposit-id" });
    transaction.localEstoque.findUnique.mockResolvedValue({ id: "central-id" });
    transaction.saldoEstoque.upsert.mockResolvedValue({ id: "deposit-balance", quantidade: 7, reservada: 0 });
    transaction.saldoEstoque.findUnique.mockResolvedValue({
      id: "central-balance",
      quantidade: 20,
      reservada: 3,
    });
    transaction.saldoEstoque.updateMany.mockResolvedValue({ count: 1 });
  });

  it("transfers available stock into the deposit and records the employee and both locations", async () => {
    const response = await POST(request({
      itemId: "item-1",
      quantidade: 2,
      motivo: MANUAL_DEPOSIT_REASONS.SEM_REQUISICAO,
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      message: "Sobra adicionada ao depósito.",
      deposito: { itemId: "item-1", quantidade: 7 },
    });
    expect(transaction.saldoEstoque.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "central-balance", quantidade: 20, reservada: 3 },
      data: { quantidade: 18 },
    }));
    expect(transaction.movimentacao.create).toHaveBeenCalledTimes(2);
    expect(transaction.movimentacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "ENTRADA",
        quantidade: 2,
        funcionarioId: 27,
        saldoEstoqueId: "deposit-balance",
        observacao: expect.stringContaining("Sobra sem requisição registrada"),
      }),
    }));
  });

  it("accepts returns from a completed request without taking stock from the main store", async () => {
    transaction.requisicao.findUnique.mockResolvedValue({
      id: "request-id",
      status: "CONCLUIDA",
      itens: [{ id: "request-item-id", itemId: "item-1", quantidade: 5 }],
    });
    const response = await POST(request({
      itemId: "item-1",
      quantidade: 2,
      requisicaoNumero: "REQ-000010",
    }));

    expect(response.status).toBe(201);
    expect(transaction.saldoEstoque.findUnique).not.toHaveBeenCalled();
    expect(transaction.movimentacao.create).toHaveBeenCalledTimes(1);
    expect(transaction.movimentacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "ENTRADA",
        requisicaoId: "request-id",
        requisicaoItemId: "request-item-id",
      }),
    }));
  });

  it("rejects excess quantity, invalid requests, and callers without staff permission", async () => {
    const invalid = await POST(request({ itemId: "item-1", quantidade: 0, motivo: "Outro" }));
    expect(invalid.status).toBe(400);

    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    const denied = await POST(request({
      itemId: "item-1",
      quantidade: 2,
      motivo: MANUAL_DEPOSIT_REASONS.SEM_REQUISICAO,
    }));
    expect(denied.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a return that exceeds the unreturned quantity of a completed request", async () => {
    transaction.requisicao.findUnique.mockResolvedValue({
      id: "request-id",
      status: "CONCLUIDA",
      itens: [{ id: "request-item-id", itemId: "item-1", quantidade: 5 }],
    });
    transaction.movimentacao.aggregate.mockResolvedValue({ _sum: { quantidade: 4 } });
    const response = await POST(request({
      itemId: "item-1",
      quantidade: 2,
      requisicaoNumero: "REQ-000010",
    }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/restante de 1/);
    expect(transaction.movimentacao.create).not.toHaveBeenCalled();
  });

  it("does not transfer reserved or unavailable main stock into the deposit", async () => {
    transaction.saldoEstoque.findUnique.mockResolvedValue({
      id: "central-balance",
      quantidade: 4,
      reservada: 3,
    });
    const response = await POST(request({
      itemId: "item-1",
      quantidade: 2,
      motivo: MANUAL_DEPOSIT_REASONS.SEM_REQUISICAO,
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Disponível: 1/);
    expect(transaction.movimentacao.create).not.toHaveBeenCalled();
  });
});
