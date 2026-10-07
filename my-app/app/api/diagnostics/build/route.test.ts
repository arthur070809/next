import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("build diagnostics endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns only a short validated Vercel commit identifier", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a1b2c3d4e5f6");
    const response = GET();

    expect(await response.json()).toEqual({ buildId: "a1b2c3d4" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not expose malformed deployment values", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "token-like-or-malformed-value");
    const response = GET();

    expect(await response.json()).toEqual({ buildId: "local" });
  });
});
