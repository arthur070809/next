import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  item: { findUnique: vi.fn() },
  localEstoque: { upsert: vi.fn() },
  saldoEstoque: { findUnique: vi.fn(), upsert: vi.fn() },
  movimentacao: { create: vi.fn() },
};
const adminMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireAdmin: () => adminMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/deposito/ajuste", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/deposito/ajuste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.mockResolvedValue({ funcionario: { id: 4 }, status: 200 });
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)) as never);
    transactionMock.item.findUnique.mockResolvedValue({ id: "item-1", ativo: true });
    transactionMock.localEstoque.upsert.mockResolvedValue({ id: "deposito-id" });
    transactionMock.saldoEstoque.findUnique.mockResolvedValue({ quantidade: 10, reservada: 0 });
    transactionMock.saldoEstoque.upsert.mockResolvedValue({ id: "saldo-id", quantidade: 6, reservada: 0 });
  });

  it("returns 401 without authentication and 403 for a non-admin", async () => {
    adminMock.mockResolvedValueOnce({ funcionario: null, status: 401 });
    expect((await POST(request({ itemId: "item-1", quantidade: 6, motivo: "contagem" }))).status).toBe(401);
    adminMock.mockResolvedValueOnce({ funcionario: null, status: 403 });
    expect((await POST(request({ itemId: "item-1", quantidade: 6, motivo: "contagem" }))).status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires a reason and logs before/after balances", async () => {
    const invalid = await POST(request({ itemId: "item-1", quantidade: 6, motivo: " " }));
    expect(invalid.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const response = await POST(request({ itemId: "item-1", quantidade: 6, motivo: "Contagem física" }));

    expect(response.status).toBe(200);
    expect(transactionMock.saldoEstoque.upsert).toHaveBeenCalledWith({
      where: { itemId_localId: { itemId: "item-1", localId: "deposito-id" } },
      create: { itemId: "item-1", localId: "deposito-id", quantidade: 6, reservada: 0 },
      update: { quantidade: 6 },
    });
    expect(transactionMock.movimentacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "AJUSTE",
        quantidade: 4,
        saldoApos: 6,
        reservadaApos: 0,
        funcionarioId: 4,
        saldoEstoqueId: "saldo-id",
        observacao: expect.stringContaining("Motivo: Contagem física"),
      }),
    }));
  });
});