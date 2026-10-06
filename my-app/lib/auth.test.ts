import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "session-token" }) })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { sessao: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), update: vi.fn() } },
}));

import { cookies } from "next/headers";
import { PapelFuncionario } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSession } from "./auth";
import { OPERATOR_IDLE_TIMEOUT_MS } from "./session-policy";

describe("operator session idle timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.sessao.findUnique).mockResolvedValue({
      id: "session-id",
      expiresAt: new Date(Date.now() + 60_000),
      funcionario: { ativo: true, papel: PapelFuncionario.OPERADOR },
      trustedDevice: null,
      trustedDeviceId: null,
    } as never);
  });

  it("refreshes operator session expiry after authenticated activity", async () => {
    const before = Date.now();

    const session = await getAuthenticatedSession();

    const update = vi.mocked(prisma.sessao.update).mock.calls[0][0];
    const expiresAt = update.data.expiresAt;
    expect(cookies).toHaveBeenCalled();
    expect(update.where).toEqual({ id: "session-id" });
    expect(expiresAt).toBeInstanceOf(Date);
    if (!(expiresAt instanceof Date)) throw new Error("Expected a Date expiry.");
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + OPERATOR_IDLE_TIMEOUT_MS - 100);
    expect(session?.expiresAt).toEqual(expiresAt);
  });

  it("expires an idle operator session without refreshing it", async () => {
    vi.mocked(prisma.sessao.findUnique).mockResolvedValueOnce({
      id: "session-id",
      expiresAt: new Date(Date.now() - 1),
      funcionario: { ativo: true, papel: PapelFuncionario.OPERADOR },
      trustedDevice: null,
      trustedDeviceId: null,
    } as never);

    expect(await getAuthenticatedSession()).toBeNull();
    expect(prisma.sessao.delete).toHaveBeenCalledWith({ where: { id: "session-id" } });
    expect(prisma.sessao.update).not.toHaveBeenCalled();
  });

  it("does not shorten or refresh sessions for other roles", async () => {
    vi.mocked(prisma.sessao.findUnique).mockResolvedValueOnce({
      id: "admin-session",
      expiresAt: new Date(Date.now() + 60_000),
      funcionario: { ativo: true, papel: PapelFuncionario.ADMIN },
      trustedDevice: null,
      trustedDeviceId: null,
    } as never);

    await getAuthenticatedSession();

    expect(prisma.sessao.update).not.toHaveBeenCalled();
  });
});
