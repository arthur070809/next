import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    estoqueItem: { count: vi.fn() },
    requisicao: { count: vi.fn() },
    depositoItem: { count: vi.fn() },
  },
}));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("GET /api/almoxarifado/resumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 7 } as Awaited<ReturnType<typeof getAuthenticatedFuncionario>>);
    vi.mocked(prisma.estoqueItem.count).mockResolvedValueOnce(12).mockResolvedValueOnce(2);
    vi.mocked(prisma.requisicao.count).mockResolvedValue(3);
    vi.mocked(prisma.depositoItem.count).mockResolvedValue(4);
  });

  it("returns only aggregate counts from the authenticated database scope", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resumo: {
      materiaisAtivos: 12,
      materiaisSemEstoque: 2,
      requisicoesPendentes: 3,
      itensComSobras: 4,
    } });
    expect(prisma.requisicao.count).toHaveBeenCalledWith({ where: { funcionarioId: 7, status: "PENDENTE" } });
  });

  it("returns 401 without a session and does not query data", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.estoqueItem.count).not.toHaveBeenCalled();
  });

  it("returns a friendly error without database details", async () => {
    vi.mocked(prisma.estoqueItem.count).mockReset().mockRejectedValueOnce(new Error("Prisma table error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Não foi possível carregar o resumo agora.");
    expect(JSON.stringify(body)).not.toMatch(/prisma|table/i);
    expect(body.errorId).toEqual(expect.any(String));
  });
});