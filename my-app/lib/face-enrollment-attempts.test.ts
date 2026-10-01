import { describe, expect, it } from "vitest";
import { faceEnrollmentAttemptLimit, faceEnrollmentWindowMs } from "./face-enrollment-attempts";

describe("face enrollment attempts", () => {
  it("keeps the configured persistent limit and window", () => {
    expect(faceEnrollmentAttemptLimit).toBe(10);
    expect(faceEnrollmentWindowMs).toBe(10 * 60 * 1000);
  });
});