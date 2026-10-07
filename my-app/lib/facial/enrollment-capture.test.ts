import { describe, expect, it } from "vitest";
import {
  enrollmentQualityInstruction,
  isEnrollmentQualityValid,
  scoreEnrollmentFrameQuality,
  selectBestEnrollmentFrames,
  shouldSubmitEnrollmentFrames,
  type EnrollmentQuality,
} from "./enrollment-capture";

const validQuality: EnrollmentQuality = {
  faceCount: 1,
  centered: true,
  sizeValid: true,
  frontFacing: true,
  brightnessValid: true,
  sharpnessValid: true,
  eyesVisible: true,
  detectionValid: true,
};

describe("automatic enrollment capture policy", () => {
  it("requires exactly one centered, well-sized, frontal, clear and illuminated face with visible eyes", () => {
    expect(isEnrollmentQualityValid(validQuality)).toBe(true);
    for (const override of [
      { faceCount: 0 },
      { faceCount: 2 },
      { centered: false },
      { sizeValid: false },
      { frontFacing: false },
      { brightnessValid: false },
      { sharpnessValid: false },
      { eyesVisible: false },
      { detectionValid: false },
    ]) {
      expect(isEnrollmentQualityValid({ ...validQuality, ...override })).toBe(false);
    }
  });

  it("provides corrective feedback for face count and quality failures", () => {
    expect(enrollmentQualityInstruction({ ...validQuality, faceCount: 2 })).toBe("Mais de um rosto na câmera");
    expect(enrollmentQualityInstruction({ ...validQuality, frontFacing: false })).toBe("Olhe de frente para a câmera");
    expect(enrollmentQualityInstruction({ ...validQuality, brightnessValid: false })).toBe("Mais luz no ambiente");
    expect(enrollmentQualityInstruction(validQuality)).toContain("captura será automática");
  });

  it("requires one second of stability, a live blink and enough post-blink candidates", () => {
    const ready = {
      stableForMs: 1_000,
      minimumStableMs: 1_000,
      blinkObserved: true,
      frameCount: 5,
      minimumFrames: 5,
    };
    expect(shouldSubmitEnrollmentFrames(ready)).toBe(true);
    expect(shouldSubmitEnrollmentFrames({ ...ready, stableForMs: 999 })).toBe(false);
    expect(shouldSubmitEnrollmentFrames({ ...ready, blinkObserved: false })).toBe(false);
    expect(shouldSubmitEnrollmentFrames({ ...ready, frameCount: 4 })).toBe(false);
  });

  it("scores sharper, frontal, eyes-open frames with suitable brightness higher", () => {
    const best = scoreEnrollmentFrameQuality({
      sharpness: 64,
      yawDegrees: 0,
      pitchDegrees: 0,
      rollDegrees: 0,
      eyesOpen: true,
      brightness: 130,
    });
    const worse = scoreEnrollmentFrameQuality({
      sharpness: 24,
      yawDegrees: 8,
      pitchDegrees: -5,
      rollDegrees: 4,
      eyesOpen: true,
      brightness: 70,
    });

    expect(best).toBeGreaterThan(worse);
    expect(scoreEnrollmentFrameQuality({
      sharpness: 64,
      yawDegrees: 0,
      pitchDegrees: 0,
      rollDegrees: 0,
      eyesOpen: false,
      brightness: 130,
    })).toBe(Number.NEGATIVE_INFINITY);
  });

  it("selects the best finite-scored frames without retaining closed-eye frames", () => {
    expect(selectBestEnrollmentFrames([
      { frame: "blurry", score: 0.3 },
      { frame: "best", score: 0.9 },
      { frame: "closed eyes", score: Number.NEGATIVE_INFINITY },
      { frame: "second", score: 0.7 },
    ], 1)).toEqual(["best"]);
    expect(selectBestEnrollmentFrames([{ frame: "one", score: 0.8 }], 3)).toEqual(["one"]);
  });
});
