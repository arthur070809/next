import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedSession: vi.fn() }));

import { getAuthenticatedSession } from "@/lib/auth";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route";

const sameOriginRequest = () => new Request("https://marcon.example/api/auth/heartbeat", {
  method: "POST",
  headers: { host: "marcon.example", origin: "https://marcon.example" },
});

describe("POST /api/auth/heartbeat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns no-store success for a valid session", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValue({ id: "session-id" } as never);

    const response = await POST(sameOriginRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the same 401 response for missing and expired sessions", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValue(null);
    const first = await POST(sameOriginRequest());
    const second = await POST(sameOriginRequest());

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(await first.text()).toBe(await second.text());
    expect(first.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an invalid origin before validating the session", async () => {
    const request = new Request("https://marcon.example/api/auth/heartbeat", {
      method: "POST",
      headers: { host: "marcon.example", origin: "https://attacker.example" },
    });

    expect((await POST(request)).status).toBe(403);
    expect(getAuthenticatedSession).not.toHaveBeenCalled();
  });

  it.each([GET, HEAD, OPTIONS, PUT, PATCH, DELETE])(
    "rejects methods other than POST without caching",
    async (handler) => {
      const response = await handler(new Request("https://marcon.example/api/auth/heartbeat"));
      expect(response.status).toBe(405);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
});
