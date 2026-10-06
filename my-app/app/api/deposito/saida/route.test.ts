import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  movimentacao: { findUnique: vi.fn(), create: vi.fn() },
  localEstoque: { findUnique: vi.fn() },
  saldoEstoque: { findUnique: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/auth", () => ({ requireAlmoxarife: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const key = "20000000-0000-4000-8000-000000000002";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/deposito/saida", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/deposito/saida", () => {
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
    transaction.movimentacao.create.mockResolvedValue({});
    transaction.localEstoque.findUnique.mockResolvedValue({ id: "deposit-id" });
    transaction.saldoEstoque.findUnique.mockResolvedValue({
      id: "deposit-balance",
      quantidade: 9,
      reservada: 2,
    });
    transaction.saldoEstoque.updateMany.mockResolvedValue({ count: 1 });
  });

  it("records a staff withdrawal from the deposit with the resulting balance", async () => {
    const response = await POST(request({ itemId: "item-1", quantidade: 3, motivo: "Uso na produção" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      deposito: { itemId: "item-1", quantidade: 6 },
      replayed: false,
    });
    expect(transaction.saldoEstoque.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "deposit-balance", quantidade: 9, reservada: 2 },
      data: { quantidade: 6 },
    }));
    expect(transaction.movimentacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "SAIDA",
        quantidade: 3,
        funcionarioId: 27,
        saldoEstoqueId: "deposit-balance",
        observacao: expect.stringContaining("Uso na produção"),
      }),
    }));
  });

  it("returns a clear error when the item is empty or reserved quantity is unavailable", async () => {
    transaction.saldoEstoque.findUnique.mockResolvedValueOnce({
      id: "deposit-balance",
      quantidade: 9,
      reservada: 7,
    });
    const response = await POST(request({ itemId: "item-1", quantidade: 3, motivo: "Uso" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Disponível: 2/);
    expect(transaction.saldoEstoque.updateMany).not.toHaveBeenCalled();
  });

  it("denies an operator without writing a movement", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    const response = await POST(request({ itemId: "item-1", quantidade: 1, motivo: "Uso" }));
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
