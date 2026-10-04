import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const localUpsertMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const createRequestMock = vi.fn();
const toRequestMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: () => authMock() }));
vi.mock("@/lib/security", () => ({ isSameOrigin: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    localEstoque: { upsert: (...args: unknown[]) => localUpsertMock(...args) },
    item: { findUnique: (...args: unknown[]) => itemFindUniqueMock(...args) },
  },
}));
vi.mock("@/lib/requisicoes-db", () => ({
  criarRequisicao: (...args: unknown[]) => createRequestMock(...args),
  toRequisicaoMock: (...args: unknown[]) => toRequestMock(...args),
}));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      itens: [{ itemId: "item-1", quantidade: 3, descricao: "Teste" }],
    }),
  });
}

describe("POST /api/requests stock reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ id: 1, papel: "OPERADOR" });
    localUpsertMock.mockResolvedValue({ id: "stock-location" });
    itemFindUniqueMock.mockResolvedValue({
      id: "item-1",
      nome: "Arruela",
      unidade: "unidades",
      ativo: true,
    });
    createRequestMock.mockResolvedValue({ numeroPedido: "REQ-000001" });
    toRequestMock.mockReturnValue({ numeroPedido: "REQ-000001" });
  });

  it("delegates the reservation to the transactional creator for operators", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(createRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      solicitanteId: 1,
      itens: [expect.objectContaining({ itemId: "item-1", quantidade: 3 })],
    }));
  });

  it("rejects profiles that cannot submit requests", async () => {
    authMock.mockResolvedValue({ id: 2, papel: "ALMOXARIFE" });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(createRequestMock).not.toHaveBeenCalled();
  });

  it("rejects inactive or missing catalog items", async () => {
    itemFindUniqueMock.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(createRequestMock).not.toHaveBeenCalled();
  });

  it("returns 409 and the fresh available amount when atomic reservation loses a race", async () => {
    createRequestMock.mockRejectedValue(Object.assign(
      new Error("Saldo livre mudou: agora há 0 para \"Arruela\"."),
      { code: "SALDO_INSUFICIENTE", itemId: "item-1", disponivel: 0 },
    ));

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "SALDO_INSUFICIENTE",
      itemId: "item-1",
      disponivel: 0,
      error: "Saldo livre mudou: agora há 0 para \"Arruela\".",
    });
  });
});
