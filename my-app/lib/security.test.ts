import { afterEach, describe, expect, it, vi } from "vitest";
import { hasExactOrigin, isSameOrigin } from "@/lib/security";

describe("same-origin request validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("strict Origin validation for session lifecycle endpoints", () => {
    it("requires an exact matching Origin and Host", () => {
      const request = new Request("https://app.example/api/auth/heartbeat", {
        method: "POST",
        headers: { origin: "https://app.example", host: "app.example" },
      });
      expect(hasExactOrigin(request)).toBe(true);
    });

    it("rejects a missing Origin header", () => {
      const request = new Request("https://app.example/api/auth/leave", { method: "POST" });
      expect(hasExactOrigin(request)).toBe(false);
    });

    it.each<HeadersInit>([
      { origin: "https://evil.example", host: "app.example" },
      { origin: "https://app.example", host: "evil.example" },
      { origin: "https://app.example/path", host: "app.example" },
    ])("rejects mismatched Origin/Host headers: %o", (headers) => {
      const request = new Request("https://app.example/api/auth/leave", {
        method: "POST",
        headers,
      });
      expect(hasExactOrigin(request)).toBe(false);
    });
  });

  it("accepts a matching Origin and Host", () => {
    const request = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { origin: "https://app.example", host: "app.example" },
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects mismatched Origins", () => {
    const request = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "app.example" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects a Host header that differs from the request host", () => {
    const request = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { host: "evil.example" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("accepts a same-origin Referer when Origin is absent", () => {
    const withHost = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { host: "app.example", referer: "https://app.example/login" },
    });
    const withoutHost = new Request("https://app.example/api/login", { method: "POST" });
    expect(isSameOrigin(withHost)).toBe(true);
    expect(isSameOrigin(withoutHost)).toBe(false);
  });

  it("rejects a cross-origin Referer when Origin is absent", () => {
    const request = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { host: "app.example", referer: "https://evil.example/login" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects Host-only requests because Host does not prevent CSRF", () => {
    const request = new Request("https://app.example/api/login", {
      method: "POST",
      headers: { host: "app.example" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("accepts an explicitly configured forwarded tunnel origin outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_EXTRA_ORIGINS", "https://thesis-threshold-trip-emails.trycloudflare.com");
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://thesis-threshold-trip-emails.trycloudflare.com",
        host: "localhost:3000",
        "x-forwarded-host": "thesis-threshold-trip-emails.trycloudflare.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects a forwarded tunnel origin that is not in the development allowlist", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_EXTRA_ORIGINS", "https://allowed.trycloudflare.com");
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://attacker.trycloudflare.com",
        host: "localhost:3000",
        "x-forwarded-host": "attacker.trycloudflare.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOrigin(request)).toBe(false);
  });

  it("keeps production behavior unchanged even when development extras and proxy headers are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_EXTRA_ORIGINS", "https://thesis-threshold-trip-emails.trycloudflare.com");
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://thesis-threshold-trip-emails.trycloudflare.com",
        host: "localhost:3000",
        "x-forwarded-host": "thesis-threshold-trip-emails.trycloudflare.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOrigin(request)).toBe(false);
  });
});
