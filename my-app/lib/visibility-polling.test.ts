import { afterEach, describe, expect, it, vi } from "vitest";
import { startVisibilityPolling } from "./visibility-polling";

class FakeVisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("visibility-aware polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses while hidden and refreshes when visible again", () => {
    vi.useFakeTimers();
    const target = new FakeVisibilityTarget();
    const callback = vi.fn();
    const stop = startVisibilityPolling(target, callback, 10000);

    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(1);

    target.visibilityState = "hidden";
    target.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(30000);
    expect(callback).toHaveBeenCalledTimes(1);

    target.visibilityState = "visible";
    target.dispatchEvent(new Event("visibilitychange"));
    expect(callback).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(3);

    stop();
    vi.advanceTimersByTime(30000);
    expect(callback).toHaveBeenCalledTimes(3);
  });
});
