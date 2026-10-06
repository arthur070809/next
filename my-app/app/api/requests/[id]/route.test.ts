import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    requisicao: { findUnique: vi.fn() },
  },
}));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeItemDescription } from "@/lib/requisition-metadata";
import { getDemoSeedRequestObservation } from "@/lib/demo-seed";
import { PapelFuncionario } from "@/generated/prisma/client";

describe("GET /api/requests/[id] metadata presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 1, papel: PapelFuncionario.ALMOXARIFE } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      id: "demo-request",
      numeroPedido: "DEMO-000105",
      solicitanteId: 17,
      observacao: getDemoSeedRequestObservation("DEMO-000105"),
      itens: [{
        descricao: encodeItemDescription("Uso de demonstração", "setor3"),
        item: { id: "item-1", nome: "Item de demonstração", codigo: "7988" },
        local: { slug: "estoque" },
      }],
    } as never);
  });

  it("strips idempotency markers and decodes item sector metadata", async () => {
    const response = await GET(new Request("http://localhost/api/requests/demo-request"), {
      params: Promise.resolve({ id: "demo-request" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requisicao.observacao).toBe("Solicitação prioritária aguardando análise.");
    expect(body.requisicao.itens[0]).toMatchObject({
      descricao: "Uso de demonstração",
      setor: "setor3",
    });
    expect(JSON.stringify(body)).not.toContain("[[idem:");
    expect(JSON.stringify(body)).not.toContain("[[setor:");
  });

  it("requires authentication before returning request details", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce(null as never);
    const response = await GET(new Request("http://localhost/api/requests/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(401);
    expect(prisma.requisicao.findUnique).not.toHaveBeenCalled();
  });

  it("does not disclose another operator's request by changing the path id", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce({
      id: 18,
      papel: PapelFuncionario.OPERADOR,
    } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValueOnce(null as never);

    const response = await GET(new Request("http://localhost/api/requests/demo-request"), {
      params: Promise.resolve({ id: "demo-request" }),
    });

    expect(response.status).toBe(404);
    expect(prisma.requisicao.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "demo-request", solicitanteId: 18 },
    }));
  });

  it("allows an operator to read only their own request", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce({
      id: 17,
      papel: PapelFuncionario.OPERADOR,
    } as never);
    const response = await GET(new Request("http://localhost/api/requests/demo-request"), {
      params: Promise.resolve({ id: "demo-request" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.requisicao.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "demo-request", solicitanteId: 17 },
    }));
  });
});
