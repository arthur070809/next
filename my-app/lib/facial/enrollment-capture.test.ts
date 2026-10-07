import { describe, expect, it } from "vitest";
import {
  enrollmentQualityInstruction,
  isEnrollmentQualityValid,
  shouldAutoCaptureEnrollmentBurst,
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
    expect(enrollmentQualityInstruction(validQuality)).toContain("captura será automática");
  });

  it("requires one second of stability, a live blink and five to eight frames", () => {
    const ready = {
      stableForMs: 1_000,
      minimumStableMs: 1_000,
      blinkObserved: true,
      frameCount: 5,
      minimumFrames: 5,
      maximumFrames: 8,
    };
    expect(shouldAutoCaptureEnrollmentBurst(ready)).toBe(true);
    expect(shouldAutoCaptureEnrollmentBurst({ ...ready, stableForMs: 999 })).toBe(false);
    expect(shouldAutoCaptureEnrollmentBurst({ ...ready, blinkObserved: false })).toBe(false);
    expect(shouldAutoCaptureEnrollmentBurst({ ...ready, frameCount: 4 })).toBe(false);
    expect(shouldAutoCaptureEnrollmentBurst({ ...ready, frameCount: 9 })).toBe(false);
  });
});
