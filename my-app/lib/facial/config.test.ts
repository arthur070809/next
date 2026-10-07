import { describe, expect, it } from "vitest";
import { getFaceEnrollmentFrameCount } from "./config";

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
});
