import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { requisicao: { findMany: vi.fn() } } }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";

describe("GET /api/minhas-requisicoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 17,
      papel: PapelFuncionario.OPERADOR,
    } as never);
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([{
      numeroPedido: "REQ-000017",
      status: "CONCLUIDA",
      prioridade: "PRIORITARIO",
      criadoEm: new Date("2026-10-01T12:00:00Z"),
      itens: [{
        quantidade: 4,
        unidadeMedida: "UN",
        descricao: "[[setor:v1:setor2]]\nManutenção",
        motivoNaoAtendido: "FALTOU",
        item: { nome: "Arruela", codigo: "129" },
        movimentacoes: [{ quantidade: 3 }],
      }],
    }] as never);
  });

  it("queries only the authenticated operator and returns item outcomes", async () => {
    const response = await GET(new Request("http://localhost/api/minhas-requisicoes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.requisicao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { solicitanteId: 17 },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: 0,
      take: 21,
    }));
    expect(body.requisicoes[0]).toMatchObject({
      status: "CONCLUIDA",
      prioridade: "prioridade",
      itens: [{
        quantidadePedida: 4,
        quantidadeSeparada: 3,
        descricao: "Manutenção",
        motivo: "FALTOU",
      }],
    });
    expect(JSON.stringify(body)).not.toContain("[[setor:");
  });

  it("uses a legacy request observation when the first item description is missing", async () => {
    vi.mocked(prisma.requisicao.findMany).mockResolvedValueOnce([{
      numeroPedido: "REQ-LEGACY",
      status: "PENDENTE",
      prioridade: "PADRAO",
      criadoEm: new Date("2026-10-01T12:00:00Z"),
      observacao: "Descrição antiga do pedido",
      itens: [{
        quantidade: 1,
        unidadeMedida: "UN",
        descricao: null,
        motivoNaoAtendido: null,
        item: { nome: "Arruela", codigo: "129" },
        movimentacoes: [],
      }],
    }] as never);

    const response = await GET(new Request("http://localhost/api/minhas-requisicoes"));
    const body = await response.json();

    expect(body.requisicoes[0].itens[0].descricao).toBe("Descrição antiga do pedido");
  });

  it("rejects non-operators before querying requisitions", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce({
      id: 1,
      papel: PapelFuncionario.ADMIN,
    } as never);

    const response = await GET(new Request("http://localhost/api/minhas-requisicoes"));

    expect(response.status).toBe(403);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/minhas-requisicoes"));

    expect(response.status).toBe(401);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("paginates only the current operator's requests", async () => {
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([] as never);
    const response = await GET(new Request("http://localhost/api/minhas-requisicoes?page=2&funcionarioId=999"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.requisicao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { solicitanteId: 17 },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: 20,
      take: 21,
    }));
    expect(body).toMatchObject({ pagina: 2, limite: 20, temMais: false });
  });

  it("reports a next page when the query returns one extra own request", async () => {
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => ({
        numeroPedido: `REQ-${index}`,
        status: "PENDENTE",
        prioridade: "PADRAO",
        criadoEm: new Date(`2026-10-01T${String(20 - index).padStart(2, "0")}:00:00Z`),
        itens: [],
      })) as never,
    );
    const response = await GET(new Request("http://localhost/api/minhas-requisicoes?page=1"));
    const body = await response.json();

    expect(body.requisicoes).toHaveLength(20);
    expect(body.temMais).toBe(true);
  });
});
