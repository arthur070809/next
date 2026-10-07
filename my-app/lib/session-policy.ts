export type SessionProfile = "operador" | "almoxarife" | "admin";

export type SessionPolicy = {
  idleTimeoutMs: number;
  leaveGraceMs: number;
};

function durationFromEnvironment(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
) {
  const configured = environment[name];
  if (configured === undefined) return fallback;
  const duration = Number(configured);
  if (!Number.isSafeInteger(duration) || duration <= 0) {
    throw new Error(`${name} deve ser um número inteiro positivo em milissegundos.`);
  }
  return duration;
}

export function createSessionPolicies(
  environment: Record<string, string | undefined> = process.env,
): Readonly<Record<SessionProfile, SessionPolicy>> {
  return {
    operador: {
      idleTimeoutMs: durationFromEnvironment(environment, "SESSION_OPERATOR_IDLE_TIMEOUT_MS", 25_000),
      leaveGraceMs: durationFromEnvironment(environment, "SESSION_OPERATOR_LEAVE_GRACE_MS", 15_000),
    },
    almoxarife: {
      idleTimeoutMs: durationFromEnvironment(environment, "SESSION_WAREHOUSE_IDLE_TIMEOUT_MS", 180_000),
      leaveGraceMs: durationFromEnvironment(environment, "SESSION_WAREHOUSE_LEAVE_GRACE_MS", 180_000),
    },
    admin: {
      idleTimeoutMs: durationFromEnvironment(environment, "SESSION_ADMIN_IDLE_TIMEOUT_MS", 180_000),
      leaveGraceMs: durationFromEnvironment(environment, "SESSION_ADMIN_LEAVE_GRACE_MS", 180_000),
    },
  };
}

export const SESSION_POLICIES = createSessionPolicies();

export const SESSION_SIGNAL_WRITE_INTERVAL_MS = 5_000;
export const OPERATOR_IDLE_TIMEOUT_MS = SESSION_POLICIES.operador.idleTimeoutMs;

export function sessionProfileForRole(role: string): SessionProfile {
  switch (role.toLowerCase()) {
    case "almoxarife":
    case "almoxarifado":
      return "almoxarife";
    case "admin":
      return "admin";
    case "operador":
      return "operador";
    default:
      return "operador";
  }
}

export type SessionLifecycleState = {
  expiresAt: Date;
  ultimoSinalEm: Date;
  saidaEm: Date | null;
  revogadaEm: Date | null;
};

export type SessionValidation =
  | { valid: true }
  | { valid: false; reason: "revoked" | "idle" | "left" | "expired" };

export function validateSessionLifecycle(
  session: SessionLifecycleState,
  profile: string,
  now: Date,
): SessionValidation {
  const policy = SESSION_POLICIES[sessionProfileForRole(profile)];
  if (session.revogadaEm !== null) return { valid: false, reason: "revoked" };
  if (session.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: "expired" };
  if (now.getTime() - session.ultimoSinalEm.getTime() > policy.idleTimeoutMs) {
    return { valid: false, reason: "idle" };
  }
  if (
    session.saidaEm !== null &&
    session.ultimoSinalEm.getTime() <= session.saidaEm.getTime() &&
    now.getTime() - session.saidaEm.getTime() > policy.leaveGraceMs
  ) {
    return { valid: false, reason: "left" };
  }
  return { valid: true };
}
