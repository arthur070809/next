import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(async () => true) } }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn(), sessionCookieName: "auth-session" }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (callback) => callback({ funcionario: { update: vi.fn() }, sessao: { deleteMany: vi.fn() } })) } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true), validatePassword: vi.fn(() => true), hashPassword: vi.fn(async () => "hash") }));

import { POST } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("change password route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects anonymous requests", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ senhaAtual: "123", novaSenha: "SenhaValida123" }) }));
    expect(response.status).toBe(401);
  });
});
