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
});
