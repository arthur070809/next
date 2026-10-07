import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    funcionario: { findFirst: vi.fn() },
    authChallenge: { create: vi.fn() },
  },
}));

import { createIdentifyFaceChallenge, verifyIdentifyFaceState } from "@/lib/login-flow";
import { prisma } from "@/lib/prisma";

describe("identify face challenge", () => {
  const originalSecret = process.env.LOGIN_CHALLENGE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOGIN_CHALLENGE_SECRET = "test-login-secret-with-at-least-32-characters";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ id: 7 } as never);
    vi.mocked(prisma.authChallenge.create).mockImplementation((async (args: Parameters<typeof prisma.authChallenge.create>[0]) => ({
      id: args.data.id,
    })) as never);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.LOGIN_CHALLENGE_SECRET;
    else process.env.LOGIN_CHALLENGE_SECRET = originalSecret;
  });

  it("creates a signed challenge without binding it to a specific employee", async () => {
    const challenge = await createIdentifyFaceChallenge("hashed-ip");
    const parsed = verifyIdentifyFaceState(challenge.loginToken);

    expect(parsed).toMatchObject({
      challengeId: challenge.challengeId,
      challenge: challenge.challenge,
      tipo: "LOGIN_FACE_IDENTIFY",
    });
    expect(prisma.authChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "LOGIN_FACE_IDENTIFY",
        ipHash: "hashed-ip",
      }),
    }));
  });

  it("rejects a tampered identify challenge token", async () => {
    const challenge = await createIdentifyFaceChallenge("hashed-ip");
    expect(verifyIdentifyFaceState(`${challenge.loginToken}x`)).toBeNull();
  });
});
