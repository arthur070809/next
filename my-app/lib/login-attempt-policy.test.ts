import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoginAttemptPolicy } from "./login-attempt-policy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("login attempt policy", () => {
  it("uses a 20-attempt default for normal and demo logins", () => {
    expect(getLoginAttemptPolicy()).toEqual({
      limit: 20,
      windowMs: 900_000,
      blockDurationMs: 900_000,
    });
    expect(getLoginAttemptPolicy(true)).toEqual({
      limit: 20,
      windowMs: 900_000,
      blockDurationMs: 300_000,
    });
  });

  it("reads configured limits and falls back on invalid values", () => {
    vi.stubEnv("LOGIN_TENTATIVAS_LIMITE", "8");
    vi.stubEnv("LOGIN_JANELA_MS", "1200000");
    vi.stubEnv("LOGIN_BLOQUEIO_MS", "0");
    expect(getLoginAttemptPolicy()).toEqual({
      limit: 8,
      windowMs: 1_200_000,
      blockDurationMs: 900_000,
    });
    vi.stubEnv("LOGIN_DEMO_TENTATIVAS_LIMITE", "200");
    vi.stubEnv("LOGIN_DEMO_BLOQUEIO_MS", "45000");
    expect(getLoginAttemptPolicy(true)).toEqual({
      limit: 20,
      windowMs: 900_000,
      blockDurationMs: 45_000,
    });
  });
});
