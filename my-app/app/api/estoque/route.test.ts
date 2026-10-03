import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  localEstoque: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  item: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  saldoEstoque: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  movimentacao: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    item: { findMany: vi.fn(), findUnique: vi.fn() },
    saldoEstoque: { update: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedFuncionario: vi.fn(async () => ({ id: 1 })),
}));

vi.mock("@/lib/security", () => ({
  isSameOrigin: vi.fn(() => true),
}));

import { GET, PATCH, POST } from "./route";
import { prisma } from "@/lib/prisma";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/estoque", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

const mockLocal = { id: "local-1", slug: "estoque", nome: "Estoque Central" };

const mockCreatedItem = {
  id: "item-1",
  nome: "Porca Sextavada Comum",
  categoria: "Porcas",
  unidade: "unidades",
  tipoUnidade: "caixa",
  quantidadePorEmbalagem: 100,
  tipoItem: "CONSUMIVEL",
  codigo: null,
  filial: null,
  grupoErp: null,
  pontoPedido: 0,
  estoqueSeguranca: 0,
  bloqueadoCompra: false,
  ultimaEntradaEmbalagens: 5,
  ativo: true,
  saldos: [{ quantidade: 500, reservada: 0, local: { slug: "estoque" } }],
};

describe("POST /api/estoque", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(((
      callback: (transaction: typeof transactionMock) => Promise<unknown>
    ) => callback(transactionMock)) as never);

    transactionMock.localEstoque.upsert.mockResolvedValue(mockLocal);
    transactionMock.localEstoque.findUnique.mockResolvedValue(mockLocal);
    transactionMock.saldoEstoque.findUnique.mockResolvedValue({
      id: "saldo-1",
      quantidade: 200,
      reservada: 0,
    });
    transactionMock.saldoEstoque.update.mockResolvedValue({
      id: "saldo-1",
      quantidade: 700,
      reservada: 0,
    });
    transactionMock.saldoEstoque.create.mockResolvedValue({
      id: "saldo-1",
      quantidade: 500,
      reservada: 0,
    });
    transactionMock.movimentacao.create.mockResolvedValue({ id: "mov-1" });
    transactionMock.item.findUnique.mockResolvedValue(mockCreatedItem);
  });

  it("calcula o total da caixa no servidor e incrementa o saldo atomicamente", async () => {
    transactionMock.item.findFirst.mockResolvedValue({ id: "item-1", nome: "Porca Sextavada Comum" });
    transactionMock.item.update.mockResolvedValue({ id: "item-1" });

    const response = await POST(
      request({
        nome: "Porca Sextavada Comum",
        categoria: "Porcas",
        tipoUnidade: "caixa",
        quantidadePorEmbalagem: 100,
        quantidadeEmbalagens: 5,
        quantidade: 1,
      })
    );

    expect(response.status).toBe(201);
    expect(transactionMock.saldoEstoque.update).toHaveBeenCalledWith({
      where: { id: "saldo-1" },
      data: { quantidade: { increment: 500 } },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("usa uma unidade por item único e ignora o total enviado pelo cliente", async () => {
    transactionMock.item.findFirst.mockResolvedValue(null);
    transactionMock.item.create.mockResolvedValue({ id: "item-2" });
    transactionMock.saldoEstoque.findUnique.mockResolvedValue(null);

    const response = await POST(
      request({
        nome: "Arruela Lisa",
        categoria: "Arruelas",
        tipoUnidade: "unidade",
        quantidadePorEmbalagem: 99,
        quantidadeEmbalagens: 20,
        quantidade: 1,
      })
    );

    expect(response.status).toBe(201);
    expect(transactionMock.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          unidade: "unidades",
          tipoUnidade: "unidade",
          quantidadePorEmbalagem: 1,
          ultimaEntradaEmbalagens: 20,
        }),
      })
    );
  });

  it("converts package quantities to base units", async () => {
    transactionMock.item.findFirst.mockResolvedValue(null);
    transactionMock.item.create.mockResolvedValue({ id: "item-3" });
    transactionMock.saldoEstoque.findUnique.mockResolvedValue(null);

    const response = await POST(
      request({
        nome: "Arruela Lisa",
        categoria: "Arruelas",
        tipoUnidade: "pacote",
        quantidadePorEmbalagem: 10,
        quantidadeEmbalagens: 3,
      })
    );

    expect(response.status).toBe(201);
    expect(transactionMock.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          unidade: "peças",
          tipoUnidade: "pacote",
          quantidadePorEmbalagem: 10,
          ultimaEntradaEmbalagens: 3,
        }),
      })
    );
  });

  it("keeps concurrent intakes as separate atomic increments", async () => {
    transactionMock.item.findFirst.mockResolvedValue({ id: "item-4" });
    transactionMock.item.update.mockResolvedValue({ id: "item-4" });

    await Promise.all([
      POST(
        request({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          tipoUnidade: "caixa",
          quantidadePorEmbalagem: 10,
          quantidadeEmbalagens: 2,
        })
      ),
      POST(
        request({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          tipoUnidade: "caixa",
          quantidadePorEmbalagem: 10,
          quantidadeEmbalagens: 3,
        })
      ),
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transactionMock.saldoEstoque.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ quantidade: { increment: 20 } }) })
    );
    expect(transactionMock.saldoEstoque.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ quantidade: { increment: 30 } }) })
    );
  });

  it.each([0, -1, 1.5, "", "3", "texto", 1_000_001, null])(
    "rejeita quantidade de embalagens inválida: %s",
    async (quantidadeEmbalagens) => {
      const response = await POST(
        request({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          tipoUnidade: "pacote",
          quantidadePorEmbalagem: 10,
          quantidadeEmbalagens,
        })
      );

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it.each([0, -1, 1.5, "", "texto", 1_000_001, null])(
    "rejeita quantidade por embalagem inválida: %s",
    async (quantidadePorEmbalagem) => {
      const response = await POST(
        request({
          nome: "Arruela Lisa",
          categoria: "Arruelas",
          tipoUnidade: "caixa",
          quantidadePorEmbalagem,
          quantidadeEmbalagens: 5,
        })
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        field: "quantidadePorEmbalagem",
        error: expect.stringContaining("quantidade por caixa"),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it("rejeita um total que excede o limite do saldo", async () => {
    const response = await POST(
      request({
        nome: "Parafuso Sextavado Comum",
        categoria: "Parafusos",
        tipoUnidade: "caixa",
        quantidadePorEmbalagem: 1_000_000,
        quantidadeEmbalagens: 1_000_000,
      })
    );

    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    [
      "GET",
      async () => GET(),
      async () =>
        vi.mocked(prisma.item.findMany).mockRejectedValue(
          Object.assign(new Error("Invalid prisma query"), { code: "P2022" })
        ),
    ],
    [
      "POST",
      async () =>
        POST(
          request({
            nome: "Arruela",
            categoria: "Arruelas",
            tipoUnidade: "unidade",
            quantidadeEmbalagens: 1,
          })
        ),
      async () =>
        vi.mocked(prisma.$transaction).mockRejectedValue(
          Object.assign(new Error("Database connection failed"), { code: "P1001" })
        ),
    ],
    [
      "PATCH",
      async () =>
        PATCH(
          new Request("http://localhost/api/estoque", {
            method: "PATCH",
            headers: { "content-type": "application/json", origin: "http://localhost" },
            body: JSON.stringify({ id: "item-1", quantidade: 1 }),
          })
        ),
      async () =>
        vi.mocked(prisma.$transaction).mockRejectedValue(
          Object.assign(new Error("Database connection failed"), { code: "P1001" })
        ),
    ],
  ])("does not expose internal errors from %s", async (_method, callRoute, configureFailure) => {
    await configureFailure();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await callRoute();
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload).toLowerCase();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/tente novamente/i);
    expect(payload.errorId).toEqual(expect.any(String));
    expect(serializedPayload).not.toMatch(/prisma|saldos_estoque|tipoUnidade/i);
    expect(log).toHaveBeenCalledWith(
      "Erro interno na API de estoque",
      expect.objectContaining({ errorId: payload.errorId })
    );
  });

  it("returns conflict status for a duplicate database constraint error", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("unique constraint"), { code: "P2002" })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      request({
        nome: "Arruela",
        categoria: "Arruelas",
        tipoUnidade: "unidade",
        quantidadeEmbalagens: 1,
      })
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toBe("Este item já existe. Atualize a lista e tente novamente.");
    expect(payload.errorId).toEqual(expect.any(String));
  });
});