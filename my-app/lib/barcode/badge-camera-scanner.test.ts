import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidBadgeCode } from "@/lib/badge-code";
import {
  BADGE_BARCODE_FORMATS,
  BadgeScannerError,
  createBadgeCameraScanner,
} from "./badge-camera-scanner";

function setup({
  detected = [],
  supportedFormats = ["code_128", "code_39", "ean_13", "ean_8", "itf", "qr_code"],
  getUserMedia: providedGetUserMedia,
}: {
  detected?: { rawValue: string; format: string }[];
  supportedFormats?: string[];
  getUserMedia?: ReturnType<typeof vi.fn>;
} = {}) {
  const frames: FrameRequestCallback[] = [];
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const video = {
    readyState: 2,
    srcObject: null as MediaStream | null,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
  } as unknown as HTMLVideoElement;
  const getUserMedia = providedGetUserMedia ?? vi.fn().mockResolvedValue(stream);
  const detect = vi.fn(async () => detected);
  const constructedFormats: string[][] = [];
  class MockBarcodeDetector {
    static getSupportedFormats = vi.fn(async () => supportedFormats);
    constructor(options: { formats: string[] }) {
      constructedFormats.push(options.formats);
    }
    detect = detect;
  }
  const onDetect = vi.fn();
  const onInvalid = vi.fn();
  const onError = vi.fn();
  const cancelFrame = vi.fn();
  const scanner = createBadgeCameraScanner({
    video,
    validate: isValidBadgeCode,
    onDetect,
    onInvalid,
    onError,
  }, {
    getDetector: () => MockBarcodeDetector,
    mediaDevices: { getUserMedia },
    secureContext: true,
    requestFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame,
  });
  return {
    scanner,
    video,
    track,
    stream,
    frames,
    detect,
    onDetect,
    onInvalid,
    onError,
    cancelFrame,
    getUserMedia,
    MockBarcodeDetector,
    constructedFormats,
  };
}

async function runFrame(frames: FrameRequestCallback[], time = 200) {
  frames.shift()?.(time);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("badge camera scanner", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses the available native formats, including QR compatibility", async () => {
    const context = setup({ supportedFormats: ["code_128", "qr_code"] });
    await context.scanner.start();
    expect(context.MockBarcodeDetector.getSupportedFormats).toHaveBeenCalledOnce();
    expect(context.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    expect(context.constructedFormats).toEqual([["code_128", "qr_code"]]);
    expect(context.video.play).toHaveBeenCalledOnce();
    context.scanner.stop();
    expect(BADGE_BARCODE_FORMATS).toContain("qr_code");
  });

  it("reports missing or incompatible BarcodeDetector support without requesting the camera", async () => {
    const noDetector = setup();
    const scannerWithoutDetector = createBadgeCameraScanner({
      video: noDetector.video,
      validate: isValidBadgeCode,
      onDetect: noDetector.onDetect,
      onInvalid: noDetector.onInvalid,
      onError: noDetector.onError,
    }, { getDetector: () => undefined, secureContext: true });
    await expect(scannerWithoutDetector.start()).rejects.toMatchObject({
      reason: "unsupported",
    } satisfies Partial<BadgeScannerError>);
    expect(noDetector.getUserMedia).not.toHaveBeenCalled();

    const unsupportedFormats = setup({ supportedFormats: ["pdf417"] });
    await expect(unsupportedFormats.scanner.start()).rejects.toMatchObject({
      reason: "unsupported",
    });
    expect(unsupportedFormats.getUserMedia).not.toHaveBeenCalled();
  });

  it("handles a denied camera permission explicitly", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    const context = setup({ getUserMedia: vi.fn().mockRejectedValue(denied) });
    await expect(context.scanner.start()).rejects.toBe(denied);
  });

  it("normalizes and reports valid detections exactly once", async () => {
    const context = setup({ detected: [{ rawValue: " 00 1234\r\n", format: "code_128" }] });
    await context.scanner.start();
    await runFrame(context.frames);
    expect(context.onDetect).toHaveBeenCalledOnce();
    expect(context.onDetect).toHaveBeenCalledWith("001234");
    expect(context.track.stop).toHaveBeenCalledOnce();
    expect(context.video.srcObject).toBeNull();
    await runFrame(context.frames, 1500);
    expect(context.onDetect).toHaveBeenCalledOnce();
  });

  it("reports invalid scans and leaves the camera ready for another attempt", async () => {
    const context = setup({ detected: [{ rawValue: "12 AB", format: "code_39" }] });
    await context.scanner.start();
    await runFrame(context.frames);
    expect(context.onInvalid).toHaveBeenCalledOnce();
    expect(context.onDetect).not.toHaveBeenCalled();
    expect(context.track.stop).not.toHaveBeenCalled();
    context.scanner.stop();
  });

  it("stops camera tracks and animation when closed", async () => {
    const context = setup();
    await context.scanner.start();
    context.scanner.stop();
    expect(context.track.stop).toHaveBeenCalledOnce();
    expect(context.cancelFrame).toHaveBeenCalledOnce();
    expect(context.video.pause).toHaveBeenCalled();
    expect(context.video.srcObject).toBeNull();
  });
});
