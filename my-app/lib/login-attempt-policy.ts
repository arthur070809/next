export type LoginAttemptPolicy = {
  limit: number;
  windowMs: number;
  blockDurationMs: number;
};

const normalDefaults = { limit: 20, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 };
const demoDefaults = { limit: 20, windowMs: 15 * 60 * 1000, blockDurationMs: 5 * 60 * 1000 };

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function getLoginAttemptPolicy(demoMode = false): LoginAttemptPolicy {
  const defaults = demoMode ? demoDefaults : normalDefaults;
  const prefix = demoMode ? "LOGIN_DEMO" : "LOGIN";
  return {
    limit: positiveInteger(
      process.env[`${prefix}_TENTATIVAS_LIMITE`],
      defaults.limit,
      100,
    ),
    windowMs: positiveInteger(
      process.env[`${prefix}_JANELA_MS`],
      defaults.windowMs,
      30 * 24 * 60 * 60 * 1000,
    ),
    blockDurationMs: positiveInteger(
      process.env[`${prefix}_BLOQUEIO_MS`],
      defaults.blockDurationMs,
      30 * 24 * 60 * 60 * 1000,
    ),
  };
}
