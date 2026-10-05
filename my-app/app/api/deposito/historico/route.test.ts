import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  movimentacao: { findMany: vi.fn(), count: vi.fn() },
} }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("deposit history route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects anonymous requests", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/deposito/historico"));
    expect(response.status).toBe(401);
  });
});
