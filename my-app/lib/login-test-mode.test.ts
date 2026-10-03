import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/login-attempts", () => ({
  normalizeLoginCode: (value: string) => value.normalize("NFKC").trim().toUpperCase(),
}));

import {
  getTestLoginBadges,
  getTestLoginBlockRetryAfter,
  isTestLoginEnabledForBadge,
  isTestLoginModeConfigured,
  logLoginTestModeStartup,
  maskLoginTestBadge,
  recordTestLoginFailure,
} from "@/lib/login-test-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local login test mode configuration", () => {
  it("enables only explicitly listed, valid badge codes outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOGIN_MODO_TESTE", "true");
    vi.stubEnv("LOGIN_TESTE_CRACHAS", "1111, 2222,abc,３３３３");

    expect(getTestLoginBadges()).toEqual(new Set(["1111", "2222", "3333"]));
    expect(isTestLoginModeConfigured()).toBe(true);
    expect(isTestLoginEnabledForBadge(" ２２２２ ")).toBe(true);
    expect(isTestLoginEnabledForBadge("4444")).toBe(false);
  });

  it("ignores the mode in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOGIN_MODO_TESTE", "true");
    vi.stubEnv("LOGIN_TESTE_CRACHAS", "3333");

    expect(isTestLoginEnabledForBadge("3333")).toBe(false);
  });

  it("requires both the enable flag and a non-empty valid allowlist", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOGIN_MODO_TESTE", "true");
    vi.stubEnv("LOGIN_TESTE_CRACHAS", "not-a-badge");

    expect(isTestLoginModeConfigured()).toBe(false);
    expect(isTestLoginEnabledForBadge("1111")).toBe(false);
  });

  it("prints a conspicuous warning when active and masks badge values", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOGIN_MODO_TESTE", "true");
    vi.stubEnv("LOGIN_TESTE_CRACHAS", "3333");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logLoginTestModeStartup();

    expect(warning).toHaveBeenCalledWith(expect.stringContaining("MODO DE TESTE DE LOGIN ATIVO"));
    expect(maskLoginTestBadge("3333")).toBe("**33");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("3333");
  });

  it("warns that test mode is ignored in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOGIN_MODO_TESTE", "true");
    vi.stubEnv("LOGIN_TESTE_CRACHAS", "3333");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logLoginTestModeStartup();

    expect(warning).toHaveBeenCalledWith(expect.stringContaining("foram ignorados"));
    expect(warning.mock.calls.flat().join(" ")).not.toContain("3333");
  });

  it("blocks after five local test-mode failures by badge and IP", () => {
    const badge = `8${Date.now().toString().slice(-3)}`;
    const ipHash = `unique-test-ip-${Date.now()}`;
    const now = Date.now();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      recordTestLoginFailure(badge, ipHash, now + attempt);
      expect(getTestLoginBlockRetryAfter(badge, ipHash, now + attempt)).toBeNull();
    }
    recordTestLoginFailure(badge, ipHash, now + 4);

    expect(getTestLoginBlockRetryAfter(badge, ipHash, now + 4)).toBe(900);
  });
});
