import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { requisicao: { findMany: vi.fn() } },
}));

import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

describe("GET /api/almoxarifado/viagens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 7,
      papel: PapelFuncionario.ALMOXARIFE,
    } as Awaited<ReturnType<typeof getAuthenticatedFuncionario>>);
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([]);
  });

  it("agrupa requisições pendentes por local e devolve as métricas", async () => {
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([
      {
        id: "req-1",
        numeroPedido: "REQ-1",
        prioridade: "PADRAO",
        criadoEm: new Date("2026-10-01T10:00:00.000Z"),
        itens: [
          {
            itemId: "item-1",
            quantidade: 2,
            item: { nome: "Caixa" },
            local: { id: "local-1", nome: "Embalagens" },
          },
        ],
      },
    ] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      viagens: [{
        localId: "local-1",
        localNome: "Embalagens",
        quantidadeRequisicoes: 1,
        quantidadeItens: 1,
      }],
      metricas: { idasSemAgrupar: 1, idasAgrupadas: 1, idasEconomizadas: 0 },
    });
    expect(prisma.requisicao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDENTE" },
        take: 200,
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("bloqueia OPERADOR", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 8,
      papel: PapelFuncionario.OPERADOR,
    } as Awaited<ReturnType<typeof getAuthenticatedFuncionario>>);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("bloqueia sem sessão", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("retorna erro genérico e registra errorId em falha de leitura", async () => {
    vi.mocked(prisma.requisicao.findMany).mockRejectedValue(
      new Error("database detail"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Não foi possível montar as viagens.");
    expect(body.errorId).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("database detail");
  });
});
