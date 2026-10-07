import { describe, expect, it } from "vitest";
import { getFaceEnrollmentFrameCount, isFaceBlinkRequired, isFaceEnrollmentConsentRequired } from "./config";

describe("facial enrollment frame count configuration", () => {
  it("defaults to one frame and accepts values from one through five", () => {
    expect(getFaceEnrollmentFrameCount(undefined)).toBe(1);
    for (const count of [1, 2, 3, 4, 5]) {
      expect(getFaceEnrollmentFrameCount(String(count))).toBe(count);
    }
  });

  it("falls back safely for invalid or out-of-range values", () => {
    for (const invalid of ["", "0", "6", "-1", "2.5", "three"]) {
      expect(getFaceEnrollmentFrameCount(invalid)).toBe(1);
    }
  });

  it("defaults consent and blink requirements off while honoring explicit opt-in", () => {
    expect(isFaceEnrollmentConsentRequired(undefined)).toBe(false);
    expect(isFaceEnrollmentConsentRequired("false")).toBe(false);
    expect(isFaceEnrollmentConsentRequired("true")).toBe(true);
    expect(isFaceBlinkRequired(undefined)).toBe(false);
    expect(isFaceBlinkRequired("false")).toBe(false);
    expect(isFaceBlinkRequired("true")).toBe(true);
  });
});
