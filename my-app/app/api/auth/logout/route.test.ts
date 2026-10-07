import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));
vi.mock("@/lib/auth", () => ({ sessionCookieName: "auth-session" }));
vi.mock("@/lib/prisma", () => ({ prisma: { sessao: { updateMany: vi.fn() } } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { POST } from "./route";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

describe("logout route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("terminates the session and clears the cookie", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: "session-token" }) } as never);
    vi.mocked(prisma.sessao.updateMany).mockResolvedValue({ count: 1 } as never);
    const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("Sessão encerrada.");
    expect(prisma.sessao.updateMany).toHaveBeenCalledWith({
      where: { token: "session-token", revogadaEm: null },
      data: { revogadaEm: expect.any(Date) },
    });
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("expires=");
  });
});
