import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/security";

describe("same-origin request validation", () => {
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
});
