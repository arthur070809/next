import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAlmoxarife: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { GET } from "./route";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("GET /api/deposito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAlmoxarife).mockResolvedValue({
      funcionario: { id: 7, papel: "ALMOXARIFE" },
      status: 200,
    } as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        nome: "Arruela",
        codigo: "A-1",
        categoria: "Fixação",
        saldos: [{
          quantidade: 5,
          movimentacoes: [{ criadoEm: new Date("2026-10-05T12:00:00Z") }],
        }],
      },
      {
        id: "item-2",
        nome: "Parafuso",
        codigo: "P-2",
        categoria: "Fixação",
        saldos: [],
      },
    ] as never);
  });

  it("lists balances using existing items, deposit balances, and latest movements", async () => {
    const response = await GET(new Request("http://localhost/api/deposito?zerados=true"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      itens: [
        {
          id: "item-1",
          nome: "Arruela",
          codigo: "A-1",
          categoria: "Fixação",
          quantidade: 5,
          ultimaMovimentacaoEm: "2026-10-05T12:00:00.000Z",
        },
        {
          id: "item-2",
          nome: "Parafuso",
          codigo: "P-2",
          categoria: "Fixação",
          quantidade: 0,
          ultimaMovimentacaoEm: null,
        },
      ],
    });
    expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ativo: true }),
      select: expect.objectContaining({ saldos: expect.any(Object) }),
    }));
  });

  it("omits zero balances by default and returns a clear empty list", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-2", nome: "Parafuso", codigo: "P-2", categoria: "Fixação", saldos: [] },
    ] as never);
    const response = await GET(new Request("http://localhost/api/deposito"));
    expect(await response.json()).toEqual({ itens: [] });
  });

  it("denies unauthenticated and operator access without querying stock", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 401 } as never);
    expect((await GET(new Request("http://localhost/api/deposito"))).status).toBe(401);
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    expect((await GET(new Request("http://localhost/api/deposito"))).status).toBe(403);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});
