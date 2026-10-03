import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn(async () => ({ id: 3 })) }));
vi.mock("@/lib/prisma", () => ({ prisma: { estoqueItem: { findMany: vi.fn() } } }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("GET /api/deposito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.estoqueItem.findMany).mockResolvedValue([]);
  });

  it("searches all active stock items, including items with zero deposit balance", async () => {
    const response = await GET(new Request("http://localhost/api/deposito?q=parafuso&zerados=false"));

    expect(response.status).toBe(200);
    expect(prisma.estoqueItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ativo: true,
        OR: expect.arrayContaining([{ nome: { contains: "parafuso" } }, { codigo: { contains: "parafuso" } }]),
      }),
    }));
    const where = vi.mocked(prisma.estoqueItem.findMany).mock.calls[0][0]?.where;
    expect(where).not.toHaveProperty("deposito");
  });

  it("limits an unfiltered balance list to positive balances unless zeros are requested", async () => {
    await GET(new Request("http://localhost/api/deposito?zerados=false"));
    expect(prisma.estoqueItem.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deposito: { is: { quantidade: { gt: 0 } } } }),
    }));

    await GET(new Request("http://localhost/api/deposito?zerados=true"));
    const where = vi.mocked(prisma.estoqueItem.findMany).mock.calls[1][0]?.where;
    expect(where).not.toHaveProperty("deposito");
  });

  it("returns 401 without login", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/deposito"));
    expect(response.status).toBe(401);
    expect(prisma.estoqueItem.findMany).not.toHaveBeenCalled();
  });
});