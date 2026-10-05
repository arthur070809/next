import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  authChallenge: { findUnique: vi.fn(), updateMany: vi.fn() },
  livenessChallenge: { findUnique: vi.fn() },
  faceTemplate: { findMany: vi.fn() },
  sessao: { create: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
} }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

describe("login face verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.livenessChallenge.findUnique).mockResolvedValue(null);
  });

  it("rejects direct attempts to bypass the signed facial challenge", async () => {
    const request = new Request("http://localhost/api/auth/login/face/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({
        challengeId: "invented",
        nonce: "invented",
        capture: "data:image/jpeg;base64,not-a-face",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });
});
