import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "session-token" }) })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { sessao: { findUnique: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() } },
}));

import { cookies } from "next/headers";
import { PapelFuncionario } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSession } from "./auth";

const now = new Date("2026-10-07T12:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-id",
    token: "session-token",
    expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    ultimoSinalEm: new Date(now.getTime() - 6_000),
    saidaEm: null,
    revogadaEm: null,
    funcionario: { ativo: true, papel: PapelFuncionario.OPERADOR },
    trustedDevice: null,
    trustedDeviceId: null,
    ...overrides,
  };
}

describe("central session validation and renewal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.sessao.findUnique).mockResolvedValue(session() as never);
    vi.mocked(prisma.sessao.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("updates signal and clears a pending leave with one conditional write", async () => {
    const pendingLeave = new Date(now.getTime() - 1_000);
    vi.mocked(prisma.sessao.findUnique).mockResolvedValueOnce(session({
      ultimoSinalEm: new Date(now.getTime() - 6_000),
      saidaEm: pendingLeave,
    }) as never);

    const result = await getAuthenticatedSession({ now });

    expect(cookies).toHaveBeenCalled();
    expect(prisma.sessao.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.sessao.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "session-id",
        token: "session-token",
        saidaEm: pendingLeave,
        revogadaEm: null,
      }),
      data: expect.objectContaining({ ultimoSinalEm: now, saidaEm: null }),
    });
    expect(result?.ultimoSinalEm).toEqual(now);
    expect(result?.saidaEm).toBeNull();
  });

  it("does not write another signal within the five-second write interval", async () => {
    vi.mocked(prisma.sessao.findUnique).mockResolvedValueOnce(session({
      ultimoSinalEm: new Date(now.getTime() - 4_999),
    }) as never);

    expect(await getAuthenticatedSession({ now })).not.toBeNull();
    expect(prisma.sessao.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an expired session without refreshing it", async () => {
    vi.mocked(prisma.sessao.findUnique).mockResolvedValueOnce(session({
      ultimoSinalEm: new Date(now.getTime() - 25_001),
    }) as never);

    expect(await getAuthenticatedSession({ now })).toBeNull();
    expect(prisma.sessao.updateMany).not.toHaveBeenCalled();
  });

  it("handles concurrent tab heartbeats without treating the losing conditional update as logout", async () => {
    const latest = session({ ultimoSinalEm: now, saidaEm: null });
    vi.mocked(prisma.sessao.findUnique)
      .mockResolvedValueOnce(session() as never)
      .mockResolvedValueOnce(latest as never);
    vi.mocked(prisma.sessao.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    expect(await getAuthenticatedSession({ now })).toEqual(latest);
    expect(prisma.sessao.findUnique).toHaveBeenCalledTimes(2);
  });

  it("fails closed and logs clearly when lifecycle columns are missing", async () => {
    const error = Object.assign(new Error("column missing"), { code: "P2022" });
    vi.mocked(prisma.sessao.findUnique).mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await getAuthenticatedSession({ now })).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "[auth] Sessão indisponível: aplique a migration add_session_lifecycle.",
      { code: "P2022" },
    );
    log.mockRestore();
  });
});
