import { describe, expect, it } from "vitest";
import { filterConsistentFaceEmbeddings } from "./face";
import { advanceFaceStability, faceStabilityFailureToleranceMs, faceStabilityRequiredMs, type FaceStabilityState } from "./face-stability";

const initial: FaceStabilityState = { accumulatedMs: 0, lastAt: 0, badSince: 0 };

function run(state: FaceStabilityState, times: number[], passes = true) {
  return times.reduce((current, now) => advanceFaceStability(current, now, passes), state);
}

describe("face stability", () => {
  it("passes after approximately one second without movement", () => {
    const result = run(initial, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100]);
    expect(result.accumulatedMs).toBeGreaterThanOrEqual(faceStabilityRequiredMs);
  });

  it("does not accumulate sustained movement", () => {
    const result = run(initial, [0, 100, 200, 300, 400], false);
    expect(result.accumulatedMs).toBe(0);
  });

  it("tolerates one isolated bad frame", () => {
    let result = run(initial, [0, 100, 200]);
    result = advanceFaceStability(result, 250, false);
    result = advanceFaceStability(result, 300, true);
    expect(result.accumulatedMs).toBeGreaterThan(0);
    expect(faceStabilityFailureToleranceMs).toBeGreaterThan(0);
  });

  it("keeps state outside React renders", () => {
    const beforeRender = run(initial, [0, 100, 200, 300]);
    const afterRender = advanceFaceStability(beforeRender, 400, true);
    expect(afterRender.accumulatedMs).toBeGreaterThan(beforeRender.accumulatedMs);
  });

  it("drops the noisiest capture and keeps a valid majority around the mean", () => {
    const embeddings = [
      [0.1, 0.1, 0.1, 0.1],
      [0.12, 0.11, 0.09, 0.1],
      [0.13, 0.12, 0.1, 0.11],
      [1.3, 1.3, 1.3, 1.3],
    ];

    const filtered = filterConsistentFaceEmbeddings(embeddings, 0.6);

    expect(filtered).toHaveLength(3);
    expect(filtered.some((embedding) => embedding[0] > 1)).toBe(false);
  });
});
