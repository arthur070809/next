import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { requisicao: { findUnique: vi.fn() } } }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("request detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/requests/1"), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(401);
  });
});
