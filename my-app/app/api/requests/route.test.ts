import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  estoqueItem: { findUnique: vi.fn(), updateMany: vi.fn() },
  saldoDeposito: { findUnique: vi.fn(), updateMany: vi.fn() },
  requisicao: { findMany: vi.fn(), create: vi.fn() },
  movimentacaoDeposito: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(), requisicao: { findMany: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn(async () => ({ id: 7 })) }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";

function request(line: Record<string, unknown>) {
  return new Request("http://localhost/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", "idempotency-key": "request-key-001" },
    body: JSON.stringify({ itens: [line], origem: "DEPOSITO", total: 999999, solicitanteId: 999 }),
  });
}

describe("POST /api/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)) as never);
    transactionMock.requisicao.findMany.mockResolvedValue([]);
    transactionMock.estoqueItem.findUnique.mockResolvedValue({ id: "item-1", nome: "Parafuso", ativo: true, quantidade: 50 });
    transactionMock.saldoDeposito.findUnique.mockResolvedValue({ quantidade: 30 });
    transactionMock.saldoDeposito.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.estoqueItem.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.requisicao.create.mockImplementation(async ({ data }) => ({ id: "request-1", numero: 145, ...data }));
  });

  it("withdraws the whole request from the deposit when it covers the quantity", async () => {
    const response = await POST(request({ itemId: "item-1", quantidade: 20 }));

    expect(response.status).toBe(201);
    expect(transactionMock.saldoDeposito.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { itemId: "item-1", quantidade: { gte: 20, equals: 30 } },
      data: { quantidade: { decrement: 20 } },
    }));
    expect(transactionMock.estoqueItem.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: "SAIDA_REQUISICAO", saldoAntes: 30, saldoDepois: 10 }),
    }));
    expect((await response.json()).requisicoes[0]).toMatchObject({ origem: "DEPOSITO", saldoDeposito: 10 });
  });

  it("uses only stock when the deposit cannot cover the whole request", async () => {
    transactionMock.saldoDeposito.findUnique.mockResolvedValue({ quantidade: 12 });
    const response = await POST(request({ itemId: "item-1", quantidade: 20 }));

    expect(response.status).toBe(201);
    expect(transactionMock.saldoDeposito.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.estoqueItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1", ativo: true, quantidade: { gte: 20, equals: 50 } },
      data: { quantidade: { decrement: 20 } },
    }));
    expect(transactionMock.movimentacaoDeposito.create).not.toHaveBeenCalled();
    expect((await response.json()).requisicoes[0]).toMatchObject({ origem: "ESTOQUE", saldoDeposito: 12 });
  });

  it("rejects insufficient stock and creates neither request nor movement", async () => {
    transactionMock.saldoDeposito.findUnique.mockResolvedValue({ quantidade: 12 });
    transactionMock.estoqueItem.findUnique.mockResolvedValue({ id: "item-1", nome: "Parafuso", ativo: true, quantidade: 5 });
    transactionMock.estoqueItem.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(request({ itemId: "item-1", quantidade: 20 }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Saldo insuficiente no estoque. Disponível: 5." });
    expect(transactionMock.requisicao.create).not.toHaveBeenCalled();
    expect(transactionMock.movimentacaoDeposito.create).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and ignores client origin and totals", async () => {
    await POST(request({ itemId: "item-1", quantidade: 2 }));

    expect(transactionMock.requisicao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ funcionarioId: 7, origem: "DEPOSITO", origemLegada: "DEPOSITO", quantidade: 2 }),
    }));
    expect(transactionMock.requisicao.create.mock.calls[0][0].data.funcionarioId).not.toBe(999);
  });
});

describe("GET /api/requests?numero=...", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a Prisma requisition preview by its sequential number", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 3, status: "RETIRADA",
    } as never);

    const response = await GET(new Request("http://localhost/api/requests?numero=145"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requisicao: { numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 3 } });
    expect(prisma.requisicao.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { numero: 145 } }));
  });

  it("returns a friendly not-found response for a missing number", async () => {
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/requests?numero=999"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Requisição #999 não encontrada no Prisma." });
  });
});