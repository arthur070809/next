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
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.requisicao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { solicitanteId: 17 },
      orderBy: { criadoEm: "desc" },
      take: 100,
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

  it("rejects non-operators before querying requisitions", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce({
      id: 1,
      papel: PapelFuncionario.ADMIN,
    } as never);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });
});
