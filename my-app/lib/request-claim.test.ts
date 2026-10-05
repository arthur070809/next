import { describe, expect, it } from "vitest";
import { resolveClaimResult } from "./request-claim";

describe("resolveClaimResult", () => {
  it("accepts only one successful conditional update as claimed", () => {
    expect(resolveClaimResult(1, null)).toEqual({ type: "claimed" });
  });

  it("reports who claimed the request when a concurrent update won", () => {
    expect(resolveClaimResult(0, { status: "ASSUMIDA", attendantName: "Almoxarife" })).toEqual({
      type: "already-claimed",
      attendantName: "Almoxarife",
    });
  });

  it("reports missing request after a zero-row conditional update", () => {
    expect(resolveClaimResult(0, null)).toEqual({ type: "not-found" });
  });

  it("distinguishes requests that are no longer available for other reasons", () => {
    expect(resolveClaimResult(0, { status: "CONCLUIDA", attendantName: null })).toEqual({
      type: "not-available",
      status: "CONCLUIDA",
    });
  });
});
