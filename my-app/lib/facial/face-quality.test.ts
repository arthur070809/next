import { describe, expect, it } from "vitest";
import {
  canStartAutomaticAttempt,
  evaluateFaceQuality,
  FACE_QUALITY_LIMITS,
  selectDominantFace,
  shouldFinishFrameCollection,
} from "./face-quality";

const usable = {
  faceCount: 1,
  faceWidthRatio: 0.2,
  centerXRatio: 0.5,
  centerYRatio: 0.5,
  yawDegrees: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  sharpness: 24,
  detectionConfidence: 0.8,
  brightness: 120,
};

describe("shared facial capture quality", () => {
  it("accepts metrics at the relaxed boundaries and returns a frame score", () => {
    const result = evaluateFaceQuality({
      ...usable,
      faceWidthRatio: FACE_QUALITY_LIMITS.minimumFaceWidthRatio,
      yawDegrees: FACE_QUALITY_LIMITS.maximumYawDegrees,
      pitchDegrees: -FACE_QUALITY_LIMITS.maximumPitchDegrees,
      rollDegrees: FACE_QUALITY_LIMITS.maximumRollDegrees,
      sharpness: FACE_QUALITY_LIMITS.minimumSharpness,
      detectionConfidence: FACE_QUALITY_LIMITS.minimumDetectionConfidence,
      brightness: FACE_QUALITY_LIMITS.minimumBrightness,
    });
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("valid");
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it.each([
    [{ faceCount: 2 }, "face-count"],
    [{ faceWidthRatio: 0.149 }, "size"],
    [{ centerXRatio: FACE_QUALITY_LIMITS.minimumCenterXRatio - 0.001 }, "position"],
    [{ yawDegrees: 25.01 }, "pose"],
    [{ pitchDegrees: -25.01 }, "pose"],
    [{ sharpness: 5.49 }, "blur"],
    [{ detectionConfidence: 0.449 }, "detection"],
    [{ brightness: 29.9 }, "light"],
    [{ brightness: 235.1 }, "light"],
    [{ yawDegrees: Number.NaN }, "detection"],
  ] as const)("rejects quality failure %o", (override, reason) => {
    expect(evaluateFaceQuality({ ...usable, ...override })).toMatchObject({ valid: false, reason });
  });

  it("uses the largest face only when it is clearly dominant", () => {
    const small = { id: "small", box: [0, 0, 0.1, 0.1] };
    const large = { id: "large", box: [0, 0, 0.4, 0.4] };
    const comparable = { id: "comparable", box: [0.5, 0, 0.35, 0.35] };
    expect(selectDominantFace([large, small], (face) => face.box)).toBe(large);
    expect(selectDominantFace([large, comparable], (face) => face.box)).toBeNull();
    expect(selectDominantFace<typeof large>([], (face) => face.box)).toBeNull();
  });

  it("captures immediately for a strong first frame, otherwise gathers a short frame burst", () => {
    expect(shouldFinishFrameCollection({ scores: [0.99], requestedFrameCount: 1, elapsedMs: 20 })).toBe(true);
    expect(shouldFinishFrameCollection({ scores: [0.75], requestedFrameCount: 1, elapsedMs: 20 })).toBe(false);
    expect(shouldFinishFrameCollection({ scores: [0.75, 0.8, 0.82], requestedFrameCount: 1, elapsedMs: 500 })).toBe(true);
    expect(shouldFinishFrameCollection({ scores: [0.8, 0.82], requestedFrameCount: 1, elapsedMs: 1_500 })).toBe(true);
  });

  it("limits automatic login attempts to one in two seconds and three per camera session", () => {
    expect(canStartAutomaticAttempt({ attempts: 0, lastAttemptAt: 0, now: 2_000, inFlight: false })).toBe(true);
    expect(canStartAutomaticAttempt({ attempts: 1, lastAttemptAt: 2_000, now: 3_999, inFlight: false })).toBe(false);
    expect(canStartAutomaticAttempt({ attempts: 1, lastAttemptAt: 2_000, now: 4_000, inFlight: true })).toBe(false);
    expect(canStartAutomaticAttempt({ attempts: 3, lastAttemptAt: 2_000, now: 4_000, inFlight: false })).toBe(false);
  });
});
