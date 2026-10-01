const factorFailures = new Map<string, { count: number; blockedUntil: number }>();

const failureThreshold = 3;
const blockDurationMs = 15 * 60 * 1000;

export function isFactorBlocked(key: string, now = Date.now()) {
  const entry = factorFailures.get(key);
  if (!entry) return false;
  if (entry.blockedUntil <= now && entry.count >= failureThreshold) {
    factorFailures.delete(key);
    return false;
  }
  return entry.blockedUntil > now;
}

export function recordFactorFailure(key: string, now = Date.now()) {
  const entry = factorFailures.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= failureThreshold) entry.blockedUntil = now + blockDurationMs;
  factorFailures.set(key, entry);
  return entry.count;
}

export function clearFactorFailures(key: string) {
  factorFailures.delete(key);
}