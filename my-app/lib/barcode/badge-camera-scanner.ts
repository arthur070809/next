import { normalizeBadgeCode } from "@/lib/badge-code";

export const BADGE_BARCODE_FORMATS = [
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "itf",
  "qr_code",
] as const;

export type BadgeBarcodeFormat = typeof BADGE_BARCODE_FORMATS[number];
export type BadgeBarcodeDetection = { rawValue: string; format: string };

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<BadgeBarcodeDetection[]>;
};

type BarcodeDetectorConstructor = {
  new (options: { formats: BadgeBarcodeFormat[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export type BadgeScannerErrorReason = "unsupported" | "insecure" | "camera-unavailable";

export class BadgeScannerError extends Error {
  constructor(readonly reason: BadgeScannerErrorReason) {
    super(reason);
    this.name = "BadgeScannerError";
  }
}

type BadgeScannerOptions = {
  video: HTMLVideoElement;
  validate: (value: string) => boolean;
  onDetect: (value: string) => void;
  onInvalid: () => void;
  onError: (error: unknown) => void;
};

type BadgeScannerDependencies = {
  getDetector: () => BarcodeDetectorConstructor | undefined;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  secureContext: boolean;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
};

const defaultDependencies: BadgeScannerDependencies = {
  getDetector: () =>
    (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector,
  mediaDevices: typeof navigator === "undefined" ? undefined : navigator.mediaDevices,
  secureContext: typeof window !== "undefined" && window.isSecureContext,
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
};

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function createBadgeCameraScanner(
  options: BadgeScannerOptions,
  dependencies: Partial<BadgeScannerDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies };
  let detector: BarcodeDetectorLike | null = null;
  let stream: MediaStream | null = null;
  let frameId: number | null = null;
  let generation = 0;
  let active = false;
  let reading = false;
  let lastReadAt = 0;
  let lastInvalidAt = Number.NEGATIVE_INFINITY;

  const stop = () => {
    generation += 1;
    active = false;
    if (frameId !== null) deps.cancelFrame(frameId);
    frameId = null;
    stopTracks(stream);
    stream = null;
    options.video.pause();
    options.video.srcObject = null;
    options.video.removeAttribute("src");
  };

  const tick: FrameRequestCallback = (time) => {
    if (!active || !detector) return;
    frameId = deps.requestFrame(tick);
    if (reading || options.video.readyState < 2 || time - lastReadAt < 150) return;
    lastReadAt = time;
    reading = true;
    void detector.detect(options.video).then((detections) => {
      if (!active) return;
      const detection = detections.find((item) => item.rawValue.trim());
      if (!detection) return;
      const value = normalizeBadgeCode(detection.rawValue);
      if (!options.validate(value)) {
        if (time - lastInvalidAt >= 1000) {
          lastInvalidAt = time;
          options.onInvalid();
        }
        return;
      }
      stop();
      options.onDetect(value);
    }).catch((error: unknown) => {
      if (!active) return;
      stop();
      options.onError(error);
    }).finally(() => {
      reading = false;
    });
  };

  return {
    async start(cameraId?: string) {
      stop();
      const startGeneration = ++generation;
      if (!deps.secureContext) throw new BadgeScannerError("insecure");
      const Detector = deps.getDetector();
      if (!Detector) throw new BadgeScannerError("unsupported");

      let formats = [...BADGE_BARCODE_FORMATS];
      if (Detector.getSupportedFormats) {
        let supported: string[];
        try {
          supported = await Detector.getSupportedFormats();
        } catch {
          throw new BadgeScannerError("unsupported");
        }
        formats = formats.filter((format) => supported.includes(format));
      }
      if (generation !== startGeneration) return;
      if (formats.length === 0) throw new BadgeScannerError("unsupported");
      try {
        detector = new Detector({ formats });
      } catch {
        throw new BadgeScannerError("unsupported");
      }

      if (!deps.mediaDevices?.getUserMedia) throw new BadgeScannerError("camera-unavailable");

      const video: MediaTrackConstraints = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: { ideal: "environment" } };
      const nextStream = await deps.mediaDevices.getUserMedia({ video, audio: false });
      if (generation !== startGeneration) {
        stopTracks(nextStream);
        return;
      }
      stream = nextStream;
      try {
        options.video.srcObject = nextStream;
        await options.video.play();
      } catch (error) {
        stop();
        throw error;
      }
      if (generation !== startGeneration) {
        stop();
        return;
      }
      active = true;
      frameId = deps.requestFrame(tick);
    },
    stop,
  };
}
