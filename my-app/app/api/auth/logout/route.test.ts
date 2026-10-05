import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));
vi.mock("@/lib/auth", () => ({ sessionCookieName: "auth-session" }));
vi.mock("@/lib/prisma", () => ({ prisma: { sessao: { deleteMany: vi.fn() } } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";

describe("logout route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("terminates the session and clears the cookie", async () => {
    const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("Sessão encerrada.");
  });
});
