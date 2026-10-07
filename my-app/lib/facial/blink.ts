export type EyePoint = readonly number[];
export type BlinkState = { closedAt: number | null; completedAt: number | null };

export const initialBlinkState: BlinkState = { closedAt: null, completedAt: null };
export const blinkClosedEarMaximum = 0.18;
export const blinkOpenEarMinimum = 0.22;
export const blinkMinimumClosedMs = 50;
export const blinkMaximumClosedMs = 800;

function distance(first: EyePoint, second: EyePoint) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

export function eyeAspectRatio(points: readonly EyePoint[]) {
  if (points.length !== 6) return null;
  const horizontal = distance([points[0][0], points[0][1]], [points[3][0], points[3][1]]);
  if (!Number.isFinite(horizontal) || horizontal <= 0) return null;
  const vertical = distance([points[1][0], points[1][1]], [points[5][0], points[5][1]])
    + distance([points[2][0], points[2][1]], [points[4][0], points[4][1]]);
  return Number.isFinite(vertical) ? vertical / (2 * horizontal) : null;
}

export function faceEyeAspectRatio(mesh: readonly EyePoint[]) {
  const rightEye = [33, 160, 158, 133, 153, 144].map((index) => mesh[index]);
  const leftEye = [362, 385, 387, 263, 373, 380].map((index) => mesh[index]);
  if ([...rightEye, ...leftEye].some((point) => !point
    || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return null;
  const right = eyeAspectRatio(rightEye as EyePoint[]);
  const left = eyeAspectRatio(leftEye as EyePoint[]);
  return right === null || left === null ? null : (right + left) / 2;
}

export function advanceBlinkState(state: BlinkState, ear: number, now: number): BlinkState {
  if (!Number.isFinite(ear) || !Number.isFinite(now)) return state;
  if (ear <= blinkClosedEarMaximum) {
    return state.closedAt === null ? { ...state, closedAt: now } : state;
  }
  if (ear < blinkOpenEarMinimum || state.closedAt === null) return state;
  const closedDuration = now - state.closedAt;
  if (closedDuration >= blinkMinimumClosedMs && closedDuration <= blinkMaximumClosedMs) {
    return { closedAt: null, completedAt: now };
  }
  return { ...state, closedAt: null };
}
