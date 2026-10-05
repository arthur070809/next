import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn(async (callback) => callback({
    localEstoque: { upsert: vi.fn() },
    item: { findUnique: vi.fn() },
    saldoEstoque: { findUnique: vi.fn(), upsert: vi.fn() },
    movimentacao: { create: vi.fn() },
  })),
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { PATCH } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("deposit route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authenticated access", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost/api/deposito", { method: "PATCH", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ itemId: "item-1", quantidade: 5 }) }));
    expect(response.status).toBe(401);
  });
});
