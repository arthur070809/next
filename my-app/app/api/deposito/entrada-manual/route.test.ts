import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  estoqueItem: { findUnique: vi.fn(), updateMany: vi.fn() },
  requisicao: { findUnique: vi.fn(), updateMany: vi.fn() },
  saldoDeposito: { findUnique: vi.fn(), upsert: vi.fn() },
  movimentacaoDeposito: { findUnique: vi.fn(), create: vi.fn() },
};
const authMock = vi.fn();
let stockQuantity = 200;

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

function request(body: Record<string, unknown>, key = "manual-key-001") {
  return new Request("http://localhost/api/deposito/entrada-manual", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", "idempotency-key": key },
    body: JSON.stringify({ ...body, usuarioId: 999, saldo: 999999, total: 999999 }),
  });
}

describe("POST /api/deposito/entrada-manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stockQuantity = 200;
    authMock.mockResolvedValue({ id: 7, role: "user" });
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)) as never);
    transactionMock.movimentacaoDeposito.findUnique.mockResolvedValue(null);
    transactionMock.estoqueItem.findUnique.mockImplementation(async () => ({ id: "item-1", nome: "Parafuso", ativo: true, quantidade: stockQuantity }));
    transactionMock.estoqueItem.updateMany.mockImplementation(async (args: { where: { quantidade: { gte: number } } }) => {
      if (stockQuantity < args.where.quantidade.gte) return { count: 0 };
      stockQuantity -= args.where.quantidade.gte;
      return { count: 1 };
    });
    transactionMock.requisicao.findUnique.mockResolvedValue({
      id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 0, status: "RETIRADA",
    });
    transactionMock.requisicao.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.saldoDeposito.findUnique.mockResolvedValue(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ quantidade: 10 });
    transactionMock.saldoDeposito.upsert.mockResolvedValue({ quantidade: 10 });
    transactionMock.movimentacaoDeposito.create.mockResolvedValue({ id: "movement-1" });
  });

  it("creates the first balance and ENTRADA_MANUAL movement from an empty deposit", async () => {
    const response = await POST(request({ itemId: "item-1", quantidade: 10, motivo: "Sobra sem requisição registrada" }));

    expect(response.status).toBe(201);
    expect(transactionMock.estoqueItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1", ativo: true, quantidade: { gte: 10 } },
      data: { quantidade: { decrement: 10 } },
    });
    expect(transactionMock.saldoDeposito.upsert).toHaveBeenCalledWith({
      where: { itemId: "item-1" },
      create: { itemId: "item-1", quantidade: 10 },
      update: { quantidade: { increment: 10 } },
    });
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ itemId: "item-1", tipo: "ENTRADA_MANUAL", quantidade: 10, saldoAntes: 0, saldoDepois: 10, usuarioId: 7, motivo: "Sobra sem requisição registrada", requisicaoId: null }),
    }));
    const payload = await response.json();
    expect(payload).toMatchObject({ estoqueAntes: 200, estoqueDepois: 190, saldoAntes: 0, saldoDepois: 10 });
    expect(payload.estoqueAntes + payload.saldoAntes).toBe(payload.estoqueDepois + payload.saldoDepois);
  });

  it("requires a reason without a request and requires text for Outro", async () => {
    expect((await POST(request({ itemId: "item-1", quantidade: 1 }))).status).toBe(400);
    expect((await POST(request({ itemId: "item-1", quantidade: 1, motivo: "Outro" }))).status).toBe(400);
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
  });

  it("rejects an amount above stock with 409 and writes nothing", async () => {
    transactionMock.estoqueItem.findUnique.mockResolvedValue({ id: "item-1", nome: "Parafuso", ativo: true, quantidade: 200 });
    transactionMock.estoqueItem.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(request({ itemId: "item-1", quantidade: 300, motivo: "Contagem inicial do depósito" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Saldo insuficiente no estoque. Disponível: 200." });
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
    expect(transactionMock.movimentacaoDeposito.create).not.toHaveBeenCalled();
  });

  it("accepts Outro with a short observation", async () => {
    const response = await POST(request({ itemId: "item-1", quantidade: 2, motivo: "Outro", observacao: "Peças avulsas" }));

    expect(response.status).toBe(201);
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ motivo: "Outro: Peças avulsas" }),
    }));
  });

  it.each([0, -1, 1.5, "", "dez", 100_001])("rejects invalid quantities: %s", async (quantidade) => {
    const response = await POST(request({ itemId: "item-1", quantidade, motivo: "Contagem inicial do depósito" }));
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("links a request and updates its returned quantity atomically", async () => {
    const response = await POST(request({ itemId: "item-1", quantidade: 3, requisicaoNumero: 145 }));

    expect(response.status).toBe(201);
    expect(transactionMock.requisicao.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "request-145", status: "RETIRADA", qtdDevolvida: { equals: 0 }, quantidade: { gte: 3 } }),
      data: { qtdDevolvida: { increment: 3 } },
    }));
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: "ENTRADA_MANUAL", requisicaoId: "request-145", motivo: null }),
    }));
    expect(transactionMock.estoqueItem.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an excessive amount and a mismatched item without writing", async () => {
    transactionMock.requisicao.findUnique.mockResolvedValueOnce({
      id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 3, status: "RETIRADA",
    });
    const excessive = await POST(request({ itemId: "item-1", quantidade: 18, requisicaoNumero: 145 }));
    expect(excessive.status).toBe(400);
    expect(await excessive.json()).toMatchObject({ error: "Só é possível devolver até 17 unidades desta requisição." });

    transactionMock.requisicao.findUnique.mockResolvedValueOnce({
      id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "other-item", quantidade: 20, qtdDevolvida: 0, status: "RETIRADA",
    });
    const mismatched = await POST(request({ itemId: "item-1", quantidade: 1, requisicaoNumero: 145 }));
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({ error: "O item selecionado não corresponde à requisição." });
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
  });

  it("rechecks the remaining return limit after a concurrent update", async () => {
    transactionMock.requisicao.findUnique
      .mockResolvedValueOnce({ id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 0, status: "RETIRADA" })
      .mockResolvedValueOnce({ id: "request-145", numero: 145, item: "Parafuso", estoqueItemId: "item-1", quantidade: 20, qtdDevolvida: 3, status: "RETIRADA" });
    transactionMock.requisicao.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(request({ itemId: "item-1", quantidade: 18, requisicaoNumero: 145 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Só é possível devolver até 17 unidades desta requisição." });
    expect(transactionMock.saldoDeposito.upsert).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and replays the idempotent result without incrementing twice", async () => {
    transactionMock.movimentacaoDeposito.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ itemId: "item-1", quantidade: 2, requisicaoId: null, saldoAntes: 10, saldoDepois: 12, tipo: "ENTRADA_MANUAL" });

    await POST(request({ itemId: "item-1", quantidade: 2, motivo: "Contagem inicial do depósito" }));
    const response = await POST(request({ itemId: "item-1", quantidade: 2, motivo: "Contagem inicial do depósito" }));

    expect(response.status).toBe(200);
    expect(transactionMock.saldoDeposito.upsert).toHaveBeenCalledTimes(1);
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledTimes(1);
  });

  it("allows only one of two concurrent transfers that exceed available stock", async () => {
    let available = 200;
    transactionMock.estoqueItem.findUnique.mockResolvedValue({ id: "item-1", nome: "Parafuso", ativo: true, quantidade: 200 });
    transactionMock.estoqueItem.updateMany.mockImplementation(async ({ where }) => {
      if (available < where.quantidade.gte) return { count: 0 };
      available -= where.quantidade.gte;
      return { count: 1 };
    });

    const results = await Promise.all([
      POST(request({ itemId: "item-1", quantidade: 150, motivo: "Contagem inicial do depósito" }, "parallel-key-001")),
      POST(request({ itemId: "item-1", quantidade: 150, motivo: "Contagem inicial do depósito" }, "parallel-key-002")),
    ]);

    expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(available).toBe(50);
    expect(transactionMock.saldoDeposito.upsert).toHaveBeenCalledTimes(1);
    expect(transactionMock.movimentacaoDeposito.create).toHaveBeenCalledTimes(1);
  });

  it("returns 401 without an authenticated user", async () => {
    authMock.mockResolvedValueOnce(null);
    const response = await POST(request({ itemId: "item-1", quantidade: 1, motivo: "Contagem inicial do depósito" }));
    expect(response.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows an admin to transfer stock into the deposit", async () => {
    authMock.mockResolvedValueOnce({ id: 2, role: "admin" });
    const response = await POST(request({ itemId: "item-1", quantidade: 1, motivo: "Contagem inicial do depósito" }));
    expect(response.status).toBe(201);
    expect(transactionMock.estoqueItem.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns a generic error id without exposing database details", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Prisma table movimentacoes_deposito missing"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request({ itemId: "item-1", quantidade: 1, motivo: "Contagem inicial do depósito" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: "Não foi possível adicionar a sobra ao depósito.", errorId: expect.any(String) });
    expect(JSON.stringify(payload).toLowerCase()).not.toMatch(/prisma|movimentacoes_deposito|table/);
  });
});