import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  requisicao: { findMany: vi.fn() },
  auditoria: { findMany: vi.fn() },
} }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("historico route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated access", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
