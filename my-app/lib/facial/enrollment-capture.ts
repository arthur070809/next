export type ScoredEnrollmentFrame<T> = { frame: T; score: number };

export function acquireEnrollmentSubmission(lock: { current: boolean }) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function selectBestEnrollmentFrames<T>(
  candidates: Array<ScoredEnrollmentFrame<T>>,
  count: number,
) {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  return candidates
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((first, second) => second.score - first.score)
    .slice(0, count)
    .map(({ frame }) => frame);
}
