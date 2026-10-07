import { describe, expect, it } from "vitest";
import {
  createSessionPolicies,
  SESSION_POLICIES,
  sessionProfileForRole,
  validateSessionLifecycle,
} from "./session-policy";

const now = new Date("2026-10-07T12:00:00.000Z");

function snapshot(overrides: Partial<{
  expiresAt: Date;
  ultimoSinalEm: Date;
  saidaEm: Date | null;
  revogadaEm: Date | null;
}> = {}) {
  return {
    expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    ultimoSinalEm: now,
    saidaEm: null,
    revogadaEm: null,
    ...overrides,
  };
}

describe("session lifecycle policy", () => {
  it("keeps an operator session valid at the idle boundary and expires it after", () => {
    const idle = SESSION_POLICIES.operador.idleTimeoutMs;
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - idle),
    }), "operador", now)).toEqual({ valid: true });
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - idle - 1),
    }), "operador", now)).toEqual({ valid: false, reason: "idle" });
  });

  it.each([
    ["operador", 25_000],
    ["almoxarife", 180_000],
    ["admin", 180_000],
  ])("%s respects its configured idle duration", (profile, idleMs) => {
    expect(SESSION_POLICIES[profile as keyof typeof SESSION_POLICIES].idleTimeoutMs).toBe(idleMs);
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - idleMs),
    }), profile, now)).toEqual({ valid: true });
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - idleMs - 1),
    }), profile, now)).toEqual({ valid: false, reason: "idle" });
  });

  it.each([
    ["operador", 15_000],
    ["almoxarife", 180_000],
    ["admin", 180_000],
  ])("%s respects its configured leave grace", (profile, graceMs) => {
    const session = snapshot({
      ultimoSinalEm: new Date(now.getTime() - graceMs),
      saidaEm: new Date(now.getTime() - graceMs),
    });
    expect(SESSION_POLICIES[profile as keyof typeof SESSION_POLICIES].leaveGraceMs).toBe(graceMs);
    expect(validateSessionLifecycle(session, profile, now)).toEqual({ valid: true });
    expect(validateSessionLifecycle({
      ...session,
      ultimoSinalEm: new Date(session.saidaEm!.getTime() - 1),
      saidaEm: new Date(session.saidaEm!.getTime() - 1),
    }, profile, now).valid).toBe(false);
  });

  it("loads positive per-profile environment overrides and rejects invalid values", () => {
    expect(createSessionPolicies({
      SESSION_OPERATOR_IDLE_TIMEOUT_MS: "30000",
      SESSION_ADMIN_LEAVE_GRACE_MS: "240000",
    })).toMatchObject({
      operador: { idleTimeoutMs: 30_000 },
      admin: { leaveGraceMs: 240_000 },
    });
    expect(() => createSessionPolicies({ SESSION_WAREHOUSE_IDLE_TIMEOUT_MS: "0" }))
      .toThrow("SESSION_WAREHOUSE_IDLE_TIMEOUT_MS");
  });

  it("keeps leave within grace valid, but expires a leave without return after grace", () => {
    const left = new Date(now.getTime() - SESSION_POLICIES.operador.leaveGraceMs);
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: left,
      saidaEm: left,
    }), "operador", now)).toEqual({ valid: true });
    const expiredLeave = new Date(left.getTime() - 1);
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: expiredLeave,
      saidaEm: expiredLeave,
    }), "operador", now)).toEqual({ valid: false, reason: "left" });
  });

  it("uses the stricter operator policy for an unknown profile", () => {
    expect(sessionProfileForRole("unexpected-role")).toBe("operador");
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - 25_001),
    }), "unexpected-role", now)).toEqual({ valid: false, reason: "idle" });
    expect(validateSessionLifecycle(snapshot({
      ultimoSinalEm: new Date(now.getTime() - 20_000),
      saidaEm: new Date(now.getTime() - 20_000),
    }), "unexpected-role", now)).toEqual({ valid: false, reason: "left" });
  });

  it("rejects revoked and absolutely expired sessions", () => {
    expect(validateSessionLifecycle(snapshot({ revogadaEm: now }), "admin", now))
      .toEqual({ valid: false, reason: "revoked" });
    expect(validateSessionLifecycle(snapshot({ expiresAt: now }), "admin", now))
      .toEqual({ valid: false, reason: "expired" });
  });
});
