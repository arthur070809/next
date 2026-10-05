export const faceStabilityRequiredMs = 1000;
export const faceStabilityFailureToleranceMs = 250;

export type FaceStabilityState = {
  accumulatedMs: number;
  lastAt: number;
  badSince: number;
};

export function advanceFaceStability(state: FaceStabilityState, now: number, passes: boolean): FaceStabilityState {
  const delta = state.lastAt > 0 ? Math.min(100, Math.max(0, now - state.lastAt)) : 0;
  if (passes) return { accumulatedMs: state.accumulatedMs + delta, lastAt: now, badSince: 0 };
  const badSince = state.badSince || now;
  return { accumulatedMs: now - badSince > faceStabilityFailureToleranceMs ? 0 : state.accumulatedMs, lastAt: now, badSince };
}
