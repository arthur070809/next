import { describe, expect, it } from "vitest";
import { acquireEnrollmentSubmission, selectBestEnrollmentFrames } from "./enrollment-capture";

describe("best facial frame selection", () => {
  it("allows only one enrollment submission until the request releases its lock", () => {
    const lock = { current: false };

    expect(acquireEnrollmentSubmission(lock)).toBe(true);
    expect(acquireEnrollmentSubmission(lock)).toBe(false);
    lock.current = false;
    expect(acquireEnrollmentSubmission(lock)).toBe(true);
  });

  it("selects the highest scored usable frames in score order", () => {
    expect(selectBestEnrollmentFrames([
      { frame: "blurred", score: 0.3 },
      { frame: "best", score: 0.9 },
      { frame: "not usable", score: Number.NEGATIVE_INFINITY },
      { frame: "second", score: 0.7 },
    ], 2)).toEqual(["best", "second"]);
  });

  it("returns an empty result for invalid counts", () => {
    expect(selectBestEnrollmentFrames([{ frame: "one", score: 0.8 }], 0)).toEqual([]);
    expect(selectBestEnrollmentFrames([{ frame: "one", score: 0.8 }], 1.5)).toEqual([]);
  });
});
