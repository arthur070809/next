import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { findMany: (...args: unknown[]) => findManyMock(...args) } } }));

import { GET } from "./route";

describe("GET /api/requests/stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ id: 1, papel: "OPERADOR" });
    findManyMock.mockResolvedValue([
      {
        id: "item-1",
        nome: "Arruela",
        unidade: "unidades",
        pontoPedido: 3,
        saldos: [
          { quantidade: 10, reservada: 4, local: { slug: "estoque" } },
          { quantidade: 2, reservada: 0, local: { slug: "deposito" } },
        ],
      },
    ]);
  });

  it("retorna físico, reservado e livre para os itens ativos", async () => {
    const response = await GET(new Request("http://localhost/api/requests/stock"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{
        itemId: "item-1",
        nome: "Arruela",
        unidade: "unidades",
        pontoPedido: 3,
        quantidadeDeposito: 2,
        fisico: 10,
        reservado: 4,
        livre: 6,
      }],
    });
  });

  it("filtra por ids quando solicitados", async () => {
    await GET(new Request("http://localhost/api/requests/stock?itemIds=item-1"));

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { ativo: true, id: { in: ["item-1"] } },
    }));
  });

  it("rejeita uma lista inválida", async () => {
    const response = await GET(new Request("http://localhost/api/requests/stock?itemIds=,,,"));
    expect(response.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("exige autenticação", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/requests/stock"));
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
