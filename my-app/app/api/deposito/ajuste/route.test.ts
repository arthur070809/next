import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  estoqueItem: { findUnique: vi.fn() },
  saldoDeposito: { findUnique: vi.fn(), upsert: vi.fn() },
  movimentacaoDeposito: { create: vi.fn() },
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
    transactionMock.estoqueItem.findUnique.mockResolvedValue({ id: "item-1", ativo: true });
    transactionMock.saldoDeposito.findUnique.mockResolvedValue({ quantidade: 10 });
    transactionMock.saldoDeposito.upsert.mockResolvedValue({ quantidade: 6 });
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
    expect(transactionMock.saldoDeposito.upsert).toHaveBeenCalledWith({
      where: { itemId: "item-1" }, create: { itemId: "item-1", quantidade: 6 }, update: { quantidade: 6 },
    });
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: "AJUSTE", quantidade: 4, saldoAntes: 10, saldoDepois: 6, usuarioId: 4, motivo: "Contagem física" }),
    }));
  });
});