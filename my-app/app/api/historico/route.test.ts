import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    requisicao: { findMany: vi.fn() },
    auditoria: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";
import { stripIdempotencyMetadata } from "@/lib/requisition-metadata";
import { getDemoSeedRequestObservation } from "@/lib/demo-seed";

function request(query = "") {
  return new Request(`http://localhost/api/historico${query}`);
}

const closedRequest = {
  id: "demo-req",
  numeroPedido: "DEMO-000101",
  status: "ANULADA",
  anuladaEm: new Date("2026-10-04T12:00:00.000Z"),
  observacao: getDemoSeedRequestObservation("DEMO-000101"),
  solicitante: { id: 1, nome: "Demo Operador", cracha: "1111" },
  atendente: { id: 2, nome: "Demo Almoxarife", cracha: "2222" },
  itens: [{
    quantidade: 2,
    separado: false,
    motivoNaoAtendido: null,
    item: { codigo: "7988", nome: "GARFO GGMX 62" },
    movimentacoes: [],
  }],
};

describe("GET /api/historico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([closedRequest] as never);
    vi.mocked(prisma.auditoria.findMany).mockResolvedValue([] as never);
  });

  it("denies operators access to the staff history", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 10,
      papel: PapelFuncionario.OPERADOR,
    } as never);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("allows warehouse staff to query history", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 11,
      papel: PapelFuncionario.ALMOXARIFE,
    } as never);

    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.eventos[0]).toMatchObject({
      evento: "cancelada",
      funcionarioId: 2,
      funcionarioNome: "Demo Almoxarife",
      produtos: [{ codigo: "7988", nome: "GARFO GGMX 62" }],
    });
    expect(JSON.stringify(body)).not.toContain("[[idem:");
    expect(body.eventos[0].descricaoMotivo).not.toBe(stripIdempotencyMetadata(closedRequest.observacao));
  });

  it("filters by product, executing employee, dates and page", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 11,
      papel: PapelFuncionario.ADMIN,
    } as never);

    const response = await GET(request("?produto=7988&funcionario=2&desde=2026-10-04&ate=2026-10-04&pagina=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.pagina).toBe(1);
    expect(body.eventos).toHaveLength(1);
    expect(body.eventos[0].descricaoMotivo).toBe("Requisição cancelada.");
  });

  it("rejects invalid date ranges", async () => {
    const response = await GET(request("?desde=2026-10-05&ate=2026-10-04"));
    expect(response.status).toBe(400);
  });
});
