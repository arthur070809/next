import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCameraStreamController } from "./camera-stream";

function makeStream() {
  const stops = [vi.fn(), vi.fn()];
  const stream = { getTracks: () => stops.map((stop) => ({ stop })) };
  return { stream: stream as unknown as MediaStream, stops };
}

function makeVideo() {
  return {
    srcObject: null as unknown,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
  };
}

describe("shared camera stream controller", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("stops every track and clears, pauses, and detaches the video idempotently", async () => {
    const { stream, stops } = makeStream();
    const video = makeVideo();
    const camera = createCameraStreamController({
      video: video as never,
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
      secureContext: true,
    });

    await camera.start({ video: true, audio: false });
    camera.stop();
    camera.stop();

    expect(stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
    expect(camera.getState()).toBe("idle");
  });

  it("stops a stream that resolves after stop was requested", async () => {
    const { stream, stops } = makeStream();
    let resolveStream!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolveStream = resolve; }));
    const camera = createCameraStreamController({
      video: makeVideo() as never,
      mediaDevices: { getUserMedia },
      secureContext: true,
    });
    const started = camera.start({ video: true });

    await Promise.resolve();
    camera.stop();
    resolveStream(stream);

    await expect(started).rejects.toMatchObject({ name: "AbortError" });
    expect(stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
  });

  it("does not stop tracks twice when video playback resolves after teardown", async () => {
    const { stream, stops } = makeStream();
    let resolvePlayback!: () => void;
    const video = makeVideo();
    video.play = vi.fn(() => new Promise<void>((resolve) => { resolvePlayback = resolve; }));
    const camera = createCameraStreamController({
      video: video as never,
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
      secureContext: true,
    });
    const started = camera.start({ video: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(video.play).toHaveBeenCalledOnce();

    camera.dispose();
    resolvePlayback();

    await expect(started).rejects.toMatchObject({ name: "AbortError" });
    expect(stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
  });

  it("stops the stream and invokes cleanup callbacks on visibility and pagehide", async () => {
    const { stream, stops } = makeStream();
    const visibilityTarget = new EventTarget();
    const pageTarget = new EventTarget();
    let hidden = false;
    const cleanup = vi.fn();
    const lifecycleStop = vi.fn();
    const camera = createCameraStreamController({
      video: makeVideo() as never,
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
      secureContext: true,
      visibilityTarget,
      pageTarget,
      isHidden: () => hidden,
      onLifecycleStop: lifecycleStop,
    });

    await camera.start({ video: true });
    camera.registerCleanup(cleanup);
    hidden = true;
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    expect(stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(lifecycleStop).toHaveBeenCalledOnce();
    expect(lifecycleStop).toHaveBeenLastCalledWith("visibilitychange");

    await camera.start({ video: true });
    pageTarget.dispatchEvent(new Event("pagehide"));
    expect(lifecycleStop).toHaveBeenCalledTimes(2);
    expect(lifecycleStop).toHaveBeenLastCalledWith("pagehide");
    camera.dispose();
  });

  it("isolates independent camera owners across StrictMode-style setup and cleanup", async () => {
    const first = makeStream();
    const second = makeStream();
    const firstCamera = createCameraStreamController({
      video: makeVideo() as never,
      mediaDevices: { getUserMedia: vi.fn(async () => first.stream) },
      secureContext: true,
    });
    const secondCamera = createCameraStreamController({
      video: makeVideo() as never,
      mediaDevices: { getUserMedia: vi.fn(async () => second.stream) },
      secureContext: true,
    });

    await firstCamera.start({ video: true });
    await secondCamera.start({ video: true });
    firstCamera.dispose();

    expect(first.stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
    expect(second.stops.map((stop) => stop.mock.calls.length)).toEqual([0, 0]);
    expect(secondCamera.getState()).toBe("active");
    secondCamera.dispose();
    expect(second.stops.map((stop) => stop.mock.calls.length)).toEqual([1, 1]);
  });

  it("reports permission denial without keeping a stream or QR marker", async () => {
    const onStateChange = vi.fn();
    const camera = createCameraStreamController({
      video: makeVideo() as never,
      mediaDevices: {
        getUserMedia: vi.fn(async () => { throw new DOMException("", "NotAllowedError"); }),
      },
      secureContext: true,
      onStateChange,
    });

    await expect(camera.start({ video: true })).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(camera.getState()).toBe("denied");
    expect(camera.getStream()).toBeNull();
    expect(onStateChange).toHaveBeenLastCalledWith("denied");
  });
});
