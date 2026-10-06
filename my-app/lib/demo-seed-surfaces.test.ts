import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { toRequisicaoMock } from "@/lib/requisicoes-db";
import { encodeItemDescription } from "@/lib/requisition-metadata";

describe("public queue representation of seeded requests", () => {
  it("exposes the decoded sector and never the internal markers", () => {
    const request = {
      numeroPedido: "DEMO-000104",
      status: "PENDENTE",
      prioridade: "PADRAO",
      criadoEm: new Date("2026-10-05T00:00:00.000Z"),
      solicitante: { nome: "Demo Operador", cracha: "1111" },
      atendente: null,
      assumidaEm: null,
      anuladaEm: null,
      itens: [{
        descricao: encodeItemDescription(undefined, "setor2"),
        local: { slug: "estoque" },
        quantidade: 1,
        unidadeMedida: "UN",
        item: { nome: "Item demo" },
      }],
    };

    const publicRequest = toRequisicaoMock(request as never);

    expect(publicRequest.setor).toBe("setor2");
    expect(publicRequest.itens?.[0].setor).toBe("setor2");
    expect(JSON.stringify(publicRequest)).not.toContain("[[setor:");
    expect(JSON.stringify(publicRequest)).not.toContain("[[idem:");
  });
});
