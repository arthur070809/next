import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { findMany: vi.fn() } } }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("items route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks unauthenticated calls", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
