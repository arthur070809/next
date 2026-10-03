import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  authChallenge: { create: vi.fn() },
  $transaction: vi.fn(),
} }));

import { PapelFuncionario } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createLoginFaceChallenge,
  createLoginSessionResponse,
  loginRequiresFace,
  verifyLoginFaceState,
} from "@/lib/login-flow";

const admin = {
  id: 1,
  nome: "Admin",
  email: "admin@example.invalid",
  cargo: "admin",
  cracha: "1000",
  papel: PapelFuncionario.ADMIN,
  mustChangePassword: false,
};

describe("login flow security", () => {
  const originalFaceSetting = process.env.LOGIN_FACIAL_OBRIGATORIO;
  const originalSecret = process.env.LOGIN_CHALLENGE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    process.env.LOGIN_CHALLENGE_SECRET = "test-login-secret-with-at-least-32-characters";
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(prisma.authChallenge.create).mockImplementation((async (args: { data: { id: string } }) => ({
      id: args.data.id,
    })) as never);
  });

  afterEach(() => {
    if (originalFaceSetting === undefined) delete process.env.LOGIN_FACIAL_OBRIGATORIO;
    else process.env.LOGIN_FACIAL_OBRIGATORIO = originalFaceSetting;
    if (originalSecret === undefined) delete process.env.LOGIN_CHALLENGE_SECRET;
    else process.env.LOGIN_CHALLENGE_SECRET = originalSecret;
    vi.unstubAllEnvs();
  });

  it("requires login facial for admins only", () => {
    expect(loginRequiresFace(PapelFuncionario.ADMIN)).toBe(true);
    expect(loginRequiresFace(PapelFuncionario.OPERADOR)).toBe(false);
    expect(loginRequiresFace(PapelFuncionario.ALMOXARIFE)).toBe(false);
  });

  it("ignores the facial-disable switch in production and warns visibly", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.LOGIN_FACIAL_OBRIGATORIO = "false";
    vi.stubEnv("NODE_ENV", "production");

    expect(loginRequiresFace(PapelFuncionario.ADMIN)).toBe(true);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("foi ignorado em produção"));
    warning.mockRestore();
  });

  it("allows the facial-disable switch only outside production", () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "false";
    vi.stubEnv("NODE_ENV", "test");
    expect(loginRequiresFace(PapelFuncionario.ADMIN)).toBe(false);
  });

  it("signs a short-lived challenge that is bound to the employee and stage", async () => {
    const challenge = await createLoginFaceChallenge(admin.id, "hashed-ip");
    const state = verifyLoginFaceState(challenge.loginToken);

    expect(state).toMatchObject({
      challengeId: challenge.challengeId,
      funcionarioId: admin.id,
      challenge: challenge.challenge,
    });
    expect(state?.expiresAt).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(challenge.expiresAt).toBeTruthy();
    expect(prisma.authChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "LOGIN_FACE",
        funcionarioId: admin.id,
        preAuthTokenHash: expect.any(String),
      }),
    }));
    expect(verifyLoginFaceState(`${challenge.loginToken}x`)).toBeNull();
  });

  it("fails closed before creating a challenge if the signing key is missing", async () => {
    delete process.env.LOGIN_CHALLENGE_SECRET;

    await expect(createLoginFaceChallenge(admin.id, "hashed-ip")).rejects.toThrow();
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("does not create a session when the employee is inactive or changed role", async () => {
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (transaction: {
      funcionario: { findFirst: ReturnType<typeof vi.fn> };
      sessao: { create: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) => callback({
      funcionario: { findFirst: vi.fn().mockResolvedValue(null) },
      sessao: { create: vi.fn() },
    })) as never);

    const response = await createLoginSessionResponse(admin, "admin");

    expect(response).toBeNull();
  });
});
