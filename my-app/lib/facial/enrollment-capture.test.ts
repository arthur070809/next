import { describe, expect, it } from "vitest";
import { acquireEnrollmentSubmission, canOpenEnrollmentCamera, selectBestEnrollmentFrames } from "./enrollment-capture";

describe("best facial frame selection", () => {
  it("allows opening the camera while models are still loading because model state is not a camera prerequisite", () => {
    expect(canOpenEnrollmentCamera({
      employeeSelected: true,
      sessionReady: true,
      consentRequired: false,
      consentGiven: false,
      cameraStarting: false,
      busy: false,
    })).toBe(true);
  });

  it("still requires employee, session, optional consent, and a free camera action", () => {
    const ready = {
      employeeSelected: true,
      sessionReady: true,
      consentRequired: true,
      consentGiven: true,
      cameraStarting: false,
      busy: false,
    };
    expect(canOpenEnrollmentCamera(ready)).toBe(true);
    expect(canOpenEnrollmentCamera({ ...ready, employeeSelected: false })).toBe(false);
    expect(canOpenEnrollmentCamera({ ...ready, sessionReady: false })).toBe(false);
    expect(canOpenEnrollmentCamera({ ...ready, consentGiven: false })).toBe(false);
    expect(canOpenEnrollmentCamera({ ...ready, cameraStarting: true })).toBe(false);
    expect(canOpenEnrollmentCamera({ ...ready, busy: true })).toBe(false);
  });

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
