import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  requisicao: { findUnique: vi.fn(), updateMany: vi.fn() },
  saldoDeposito: { findUnique: vi.fn(), upsert: vi.fn() },
  movimentacaoDeposito: { findUnique: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn(async () => ({ id: 9 })) }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

function request(quantidade: number) {
  return new Request("http://localhost/api/requests/request-145/sobra", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", "idempotency-key": "return-key-001" },
    body: JSON.stringify({ quantidade, itemId: "attacker-item", origem: "ESTOQUE" }),
  });
}

describe("POST /api/requests/[id]/sobra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)) as never);
    transactionMock.movimentacaoDeposito.findUnique.mockResolvedValue(null);
    transactionMock.requisicao.findUnique.mockResolvedValue({
      id: "request-145", numero: 145, item: "Parafuso", quantidade: 20, qtdDevolvida: 0,
      status: "RETIRADA", estoqueItemId: "item-1", estoqueItem: { nome: "Parafuso" },
    });
    transactionMock.requisicao.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.saldoDeposito.findUnique.mockResolvedValue({ quantidade: 12 });
    transactionMock.saldoDeposito.upsert.mockResolvedValue({ quantidade: 15 });
    transactionMock.movimentacaoDeposito.create.mockResolvedValue({ id: "movement-1" });
  });

  it("records a partial return linked to the request and increments the deposit", async () => {
    const response = await POST(request(3), { params: Promise.resolve({ id: "request-145" }) });

    expect(response.status).toBe(201);
    expect(transactionMock.requisicao.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "request-145", status: "RETIRADA", quantidade: { gte: 3 }, qtdDevolvida: { equals: 0 } }),
      data: { qtdDevolvida: { increment: 3 } },
    }));
    expect(transactionMock.saldoDeposito.upsert).toHaveBeenCalledWith({
      where: { itemId: "item-1" },
      create: { itemId: "item-1", quantidade: 3 },
      update: { quantidade: { increment: 3 } },
    });
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ itemId: "item-1", tipo: "ENTRADA_SOBRA", requisicaoId: "request-145", usuarioId: 9, saldoAntes: 12, saldoDepois: 15 }),
    }));
    expect((await response.json()).message).toContain("Sobra registrada: 3 un da requisição #145.");
  });

  it("rejects returns above the remaining quantity without writing", async () => {
    transactionMock.requisicao.findUnique.mockResolvedValueOnce({
      id: "request-145", numero: 145, item: "Parafuso", quantidade: 20, qtdDevolvida: 3,
      status: "RETIRADA", estoqueItemId: "item-1", estoqueItem: { nome: "Parafuso" },
    });

    const response = await POST(request(18), { params: Promise.resolve({ id: "request-145" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Só é possível devolver até 17 unidades desta requisição." });
    expect(transactionMock.requisicao.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
    expect(transactionMock.movimentacaoDeposito.create).not.toHaveBeenCalled();
  });

  it.each(["ANULADA", "PENDENTE"])("rejects a request that is %s", async (status) => {
    transactionMock.requisicao.findUnique.mockResolvedValueOnce({
      id: "request-145", numero: 145, quantidade: 20, qtdDevolvida: 0, status, estoqueItemId: "item-1",
    });

    const response = await POST(request(1), { params: Promise.resolve({ id: "request-145" }) });

    expect(response.status).toBe(400);
    expect(transactionMock.requisicao.updateMany).not.toHaveBeenCalled();
  });

  it("returns conflict when a concurrent submission already used the idempotency key", async () => {
    transactionMock.movimentacaoDeposito.findUnique.mockResolvedValue({ itemId: "item-1", requisicaoId: "request-145", saldoDepois: 15 });

    const response = await POST(request(3), { params: Promise.resolve({ id: "request-145" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Esta sobra já foi registrada." });
    expect(transactionMock.requisicao.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
  });
});