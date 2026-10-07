import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { sessao: { updateMany: vi.fn() } },
}));

import { getAuthenticatedSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route";

const validSession = {
  id: "session-id",
  token: "opaque-session-token",
  ultimoSinalEm: new Date("2026-10-07T12:00:00.000Z"),
  saidaEm: null,
};
const sameOriginRequest = () => new Request("https://marcon.example/api/auth/leave", {
  method: "POST",
  headers: { host: "marcon.example", origin: "https://marcon.example" },
});

describe("POST /api/auth/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.sessao.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("records only saidaEm for the session identified by the cookie", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValue(validSession as never);

    const response = await POST(sameOriginRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getAuthenticatedSession).toHaveBeenCalledWith({ touch: false });
    expect(prisma.sessao.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-id",
        token: "opaque-session-token",
        ultimoSinalEm: validSession.ultimoSinalEm,
        saidaEm: null,
        revogadaEm: null,
      },
      data: { saidaEm: expect.any(Date) },
    });
  });

  it("does not reveal whether the session was missing or expired", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValue(null);
    const first = await POST(sameOriginRequest());
    const second = await POST(sameOriginRequest());

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(await first.text()).toBe(await second.text());
    expect(prisma.sessao.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid origin and does not write an exit marker", async () => {
    const request = new Request("https://marcon.example/api/auth/leave", {
      method: "POST",
      headers: { host: "marcon.example", origin: "https://attacker.example" },
    });

    expect((await POST(request)).status).toBe(403);
    expect(getAuthenticatedSession).not.toHaveBeenCalled();
    expect(prisma.sessao.updateMany).not.toHaveBeenCalled();
  });

  it.each([GET, HEAD, OPTIONS, PUT, PATCH, DELETE])(
    "rejects methods other than POST without caching",
    async (handler) => {
      const response = await handler(new Request("https://marcon.example/api/auth/leave"));
      expect(response.status).toBe(405);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
});
