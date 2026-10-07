import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAlmoxarife: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    requisicaoItem: { findMany: vi.fn() },
  },
}));

import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeItemDescription } from "@/lib/requisition-metadata";
import { GET } from "./route";

describe("GET /api/deposito/sobras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAlmoxarife).mockResolvedValue({
      funcionario: { id: 7, papel: "ALMOXARIFE" },
      status: 200,
    } as never);
  });

  it("groups delivered minimum-lot excess by sector and product without treating it as deposit stock", async () => {
    vi.mocked(prisma.requisicaoItem.findMany).mockResolvedValue([{
      id: "request-item-1",
      quantidade: 2,
      descricao: encodeItemDescription(undefined, "setor2"),
      item: {
        id: "item-1",
        codigo: "129",
        nome: "Rodízio",
        categoria: "Rodízios",
        saldos: [
          { quantidade: 10, reservada: 2, local: { slug: "estoque" } },
          { quantidade: 1, reservada: 0, local: { slug: "deposito" } },
        ],
      },
      requisicao: { numeroPedido: "REQ-1" },
      movimentacoes: [{ quantidade: 5 }],
    }] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      registros: [{
        itemId: "item-1",
        setor: "setor2",
        quantidadePedida: 2,
        quantidadeSeparada: 5,
        quantidadeExcedente: 3,
        pedidos: ["REQ-1"],
        estoqueLivre: 8,
        saldoDeposito: 1,
        categoria: "Rodízios",
      }],
      totaisPorSetor: [{
        setor: "setor2",
        quantidadePedida: 2,
        quantidadeSeparada: 5,
        quantidadeExcedente: 3,
      }],
      totaisPorProduto: [{
        itemId: "item-1",
        produto: "Rodízio",
        quantidadeExcedente: 3,
      }],
      aviso: expect.stringContaining("não uma sobra física registrada"),
    });
  });

  it("enforces warehouse/admin permission and returns an explicit empty result", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    expect((await GET()).status).toBe(403);
    expect(prisma.requisicaoItem.findMany).not.toHaveBeenCalled();

    vi.mocked(prisma.requisicaoItem.findMany).mockResolvedValueOnce([] as never);
    const response = await GET();
    expect(await response.json()).toMatchObject({ registros: [] });
  });

  it("keeps the total by sector equal to the total by product", async () => {
    vi.mocked(prisma.requisicaoItem.findMany).mockResolvedValue([
      {
        id: "a",
        quantidade: 1,
        descricao: encodeItemDescription(undefined, "setor1"),
        item: { id: "p1", codigo: "129", nome: "Rodízio", categoria: "Rodízios", saldos: [] },
        requisicao: { numeroPedido: "REQ-1" },
        movimentacoes: [{ quantidade: 4 }],
      },
      {
        id: "b",
        quantidade: 2,
        descricao: encodeItemDescription(undefined, "setor2"),
        item: { id: "p1", codigo: "129", nome: "Rodízio", categoria: "Rodízios", saldos: [] },
        requisicao: { numeroPedido: "REQ-2" },
        movimentacoes: [{ quantidade: 5 }],
      },
    ] as never);
    const body = await (await GET()).json();
    const bySector = body.totaisPorSetor.reduce((sum: number, row: { quantidadeExcedente: number }) => sum + row.quantidadeExcedente, 0);
    const byProduct = body.totaisPorProduto.reduce((sum: number, row: { quantidadeExcedente: number }) => sum + row.quantidadeExcedente, 0);
    expect(bySector).toBe(6);
    expect(byProduct).toBe(bySector);
  });

  it("distinguishes unauthenticated users and rejects direct operator requests", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 401 } as never);
    expect((await GET()).status).toBe(401);
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    expect((await GET()).status).toBe(403);
    expect(prisma.requisicaoItem.findMany).not.toHaveBeenCalled();
  });
});
