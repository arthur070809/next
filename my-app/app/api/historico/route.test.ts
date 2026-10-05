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

describe("GET /api/historico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.requisicao.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditoria.findMany).mockResolvedValue([] as never);
  });

  it("denies operators access to the staff history", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 10,
      papel: PapelFuncionario.OPERADOR,
    } as never);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(prisma.requisicao.findMany).not.toHaveBeenCalled();
  });

  it("allows warehouse staff to query history", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 11,
      papel: PapelFuncionario.ALMOXARIFE,
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
  });
});
