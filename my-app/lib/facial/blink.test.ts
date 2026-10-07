import { describe, expect, it } from "vitest";
import {
  advanceBlinkState,
  blinkMaximumClosedMs,
  blinkMinimumClosedMs,
  eyeAspectRatio,
  initialBlinkState,
} from "./blink";

const openEye = [
  [0, 0],
  [1, 1],
  [3, 1],
  [4, 0],
  [3, -1],
  [1, -1],
] as const;

const closedEye = [
  [0, 0],
  [1, 0.2],
  [3, 0.2],
  [4, 0],
  [3, -0.2],
  [1, -0.2],
] as const;

describe("EAR blink detection", () => {
  it("calculates an eye aspect ratio from six landmarks", () => {
    expect(eyeAspectRatio(openEye)).toBeCloseTo(0.5);
    expect(eyeAspectRatio(closedEye)).toBeCloseTo(0.1);
    expect(eyeAspectRatio(openEye.slice(0, 5))).toBeNull();
  });

  it("requires a closed-to-open transition with realistic timing", () => {
    const closedEar = eyeAspectRatio(closedEye) ?? 0;
    const openEar = eyeAspectRatio(openEye) ?? 1;
    const closed = advanceBlinkState(initialBlinkState, closedEar, 100);
    expect(advanceBlinkState(closed, openEar, 100 + blinkMinimumClosedMs - 1).completedAt).toBeNull();
    expect(advanceBlinkState(closed, openEar, 100 + blinkMinimumClosedMs).completedAt).toBe(150);
    expect(advanceBlinkState(closed, openEar, 100 + blinkMaximumClosedMs + 1).completedAt).toBeNull();
  });
});
