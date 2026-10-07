import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { requisicao: { findMany: vi.fn() } } }));

import { listOpenRequisitions, toRequisicaoMock } from "@/lib/requisicoes-db";
import { prisma } from "@/lib/prisma";
import { encodeItemDescription } from "@/lib/requisition-metadata";

describe("public queue representation of seeded requests", () => {
  it("exposes the decoded sector and never the internal markers", () => {
    const request = {
      numeroPedido: "DEMO-000104",
      id: "demo-request-id",
      status: "PENDENTE",
      prioridade: "PADRAO",
      criadoEm: new Date("2026-10-05T00:00:00.000Z"),
      solicitante: { nome: "Demo Operador", cracha: "1111" },
      atendente: null,
      assumidaEm: null,
      anuladaEm: null,
      itens: [{
        descricao: encodeItemDescription("Uso na montagem", "setor2"),
        local: { slug: "estoque" },
        quantidade: 1,
        unidadeMedida: "UN",
        item: { nome: "Item demo" },
      }],
    };

    const publicRequest = toRequisicaoMock(request as never);

    expect(publicRequest.setor).toBe("setor2");
    expect(publicRequest.id).toBe("demo-request-id");
    expect(publicRequest.itens?.[0].setor).toBe("setor2");
    expect(publicRequest.descricao).toBe("Uso na montagem");
    expect(publicRequest.itens?.[0].descricao).toBe("Uso na montagem");
    expect(JSON.stringify(publicRequest)).not.toContain("[[setor:");
    expect(JSON.stringify(publicRequest)).not.toContain("[[idem:");
  });

  it("requests deterministic priority, creation-time, and id ordering from Prisma", async () => {
    vi.mocked(prisma.requisicao.findMany).mockResolvedValueOnce([] as never);

    await listOpenRequisitions();

    expect(prisma.requisicao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }, { id: "asc" }],
    }));
  });

  it("keeps legacy request-level description when item-level description is absent", () => {
    const request = {
      numeroPedido: "REQ-LEGACY",
      status: "PENDENTE",
      prioridade: "PADRAO",
      criadoEm: new Date("2026-10-05T00:00:00.000Z"),
      observacao: "Descrição antiga do pedido",
      solicitante: { nome: "Operador", cracha: "1111" },
      atendente: null,
      assumidaEm: null,
      anuladaEm: null,
      itens: [{
        descricao: null,
        local: { slug: "estoque" },
        quantidade: 1,
        unidadeMedida: "UN",
        item: { nome: "Item antigo" },
      }],
    };

    const publicRequest = toRequisicaoMock(request as never);

    expect(publicRequest.descricao).toBe("Descrição antiga do pedido");
    expect(publicRequest.itens?.[0].descricao).toBe("Descrição antiga do pedido");
  });
});
