import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addFaceCameraAttempt,
  addFaceModelAsset,
  createFaceLoadDiagnostics,
  createPrivacySafeDiagnostics,
  createSingletonLoader,
  faceCameraConstraintFallbacks,
  faceLoadProgress,
  faceLoadTimeouts,
  faceModelAssetUrl,
  runFaceBackendFallback,
  startFaceLoadWatchdog,
  startCameraWithConstraintFallback,
  transitionFaceLoadState,
  type FaceLoadUiState,
} from "./load-diagnostics";

afterEach(() => vi.useRealTimers());

describe("facial model loading diagnostics", () => {
  it("enforces idle, loading, slow, ready, and error state transitions", () => {
    const transition = (state: FaceLoadUiState, event: Parameters<typeof transitionFaceLoadState>[1]) =>
      transitionFaceLoadState(state, event);
    expect(transition("idle", "start")).toBe("loading");
    expect(transition("loading", "slow")).toBe("slow");
    expect(transition("slow", "success")).toBe("ready");
    expect(transition("loading", "timeout")).toBe("error");
    expect(transition("error", "start")).toBe("loading");
    expect(transition("ready", "slow")).toBe("ready");
  });

  it("moves through slow and hard-timeout notifications and clears watchdog timers", () => {
    vi.useFakeTimers();
    const slow = vi.fn();
    const timedOut = vi.fn();
    const watchdog = startFaceLoadWatchdog(slow, timedOut);

    vi.advanceTimersByTime(faceLoadTimeouts.slowMs);
    expect(slow).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(faceLoadTimeouts.hardMs - faceLoadTimeouts.slowMs);
    expect(timedOut).toHaveBeenCalledOnce();
    expect(watchdog.didTimeout()).toBe(true);
    watchdog.clear();
  });

  it("falls back through each available backend and records the original failures", async () => {
    const attempts: string[] = [];
    const result = await runFaceBackendFallback(
      ["webgl", "wasm", "cpu"],
      async (backend) => {
        attempts.push(backend);
        if (backend !== "cpu") throw new DOMException(`${backend} unavailable`, "NotSupportedError");
        return "loaded";
      },
      vi.fn(),
      (() => {
        let time = 0;
        return () => ++time;
      })(),
    );

    expect(attempts).toEqual(["webgl", "wasm", "cpu"]);
    expect(result).toEqual({ backend: "cpu", value: "loaded" });
  });

  it("builds a local-only model URL allowlist and rejects external paths", () => {
    for (const file of ["blazeface.json", "blazeface.bin", "facemesh.json", "facemesh.bin", "mobileface.json", "mobileface.bin", "emotion.json", "emotion.bin"]) {
      expect(faceModelAssetUrl(file)).toMatch(/^\/models\/human\//);
    }
    expect(() => faceModelAssetUrl("https://example.org/model.json")).toThrow("não permitido");
  });

  it("uses a descending camera constraint cascade", () => {
    expect(faceCameraConstraintFallbacks()).toEqual([
      { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: true, audio: false },
    ]);
  });

  it("tries each camera constraint in order and preserves original errors", async () => {
    const constraints = faceCameraConstraintFallbacks();
    const attempts: string[] = [];
    const outcomes: Array<{ result: string; errorName?: string }> = [];
    const stream = { active: true };
    const result = await startCameraWithConstraintFallback(
      async (candidate) => {
        attempts.push(JSON.stringify(candidate));
        if (attempts.length < 3) throw new DOMException("unsupported", "OverconstrainedError");
        return stream;
      },
      constraints,
      ({ result: attemptResult, errorName }) => outcomes.push({ result: attemptResult, errorName }),
    );
    expect(result).toBe(stream);
    expect(attempts).toEqual(constraints.map((candidate) => JSON.stringify(candidate)));
    expect(outcomes).toEqual([
      { result: "error", errorName: "OverconstrainedError" },
      { result: "error", errorName: "OverconstrainedError" },
      { result: "success", errorName: undefined },
    ]);

    await expect(startCameraWithConstraintFallback(
      async () => { throw new DOMException("denied", "NotAllowedError"); },
      [constraints[0]],
    )).rejects.toMatchObject({ name: "NotAllowedError", message: "denied" });
  });

  it("copies only operational details and never includes identity or biometric data", () => {
    let diagnostics = createFaceLoadDiagnostics();
    diagnostics = addFaceModelAsset(diagnostics, {
      model: "blazeface.json",
      url: "/models/human/blazeface.json",
      status: 200,
      bytes: 120,
      downloadedBytes: 120,
      elapsedMs: 42,
    });
    diagnostics = addFaceCameraAttempt(diagnostics, {
      constraints: { video: { facingMode: { ideal: "user" } }, audio: false },
      elapsedMs: 5,
      result: "error",
      errorName: "NotAllowedError",
      errorMessage: "Permission denied",
    });
    const serialized = JSON.stringify(createPrivacySafeDiagnostics(diagnostics));

    expect(faceLoadProgress(diagnostics)).toBeGreaterThan(0);
    expect(serialized).toContain("/models/human/blazeface.json");
    expect(serialized).not.toMatch(/nome|cracha|embedding|nonce|token|distancia|distance/i);
  });

  it("reuses one promise for concurrent calls and allows retry after rejection", async () => {
    const loader = createSingletonLoader<number>();
    const factory = vi.fn(async () => 42);
    const first = loader.load(factory);
    const second = loader.load(factory);

    expect(first).toBe(second);
    await expect(first).resolves.toBe(42);
    expect(factory).toHaveBeenCalledOnce();

    const retryLoader = createSingletonLoader<number>();
    const rejected = retryLoader.load(async () => { throw new Error("first failure"); });
    await expect(rejected).rejects.toThrow("first failure");
    await expect(retryLoader.load(async () => 7)).resolves.toBe(7);
  });
});
