import jsQR from "jsqr";

export type QrDetection = { rawValue: string; format: string };
export type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<QrDetection[]>;
};
export type ScannerDiagnostics = {
  decoder: "native" | "jsqr" | "loading";
  nativeSupported: boolean;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  framesRead: number;
  decodeErrors: number;
  lastError: string;
  lastRawText: string;
};

type JsQr = typeof jsQR;
type ScannerOptions = {
  onDecode: (detection: QrDetection) => void | Promise<void>;
  onDiagnostics?: (diagnostics: ScannerDiagnostics) => void;
};

type ScannerDependencies = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  loadJsQr: () => Promise<JsQr>;
  getNativeDetector: () => Promise<BarcodeDetectorLike | null>;
  createCanvas: () => HTMLCanvasElement;
  now: () => number;
};

const defaultDependencies: ScannerDependencies = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  loadJsQr: async () => jsQR,
  getNativeDetector: async () => {
    type DetectorConstructor = {
      new (options: { formats: string[] }): BarcodeDetectorLike;
      getSupportedFormats?: () => Promise<string[]>;
    };
    const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Detector) return null;
    try {
      const supported = await Detector.getSupportedFormats?.();
      if (!supported?.includes("qr_code")) return null;
      return new Detector({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  },
  createCanvas: () => document.createElement("canvas"),
  now: () => performance.now(),
};

export function decodeFrame(image: ImageData, decoder: JsQr = jsQR): string | null {
  try {
    return decoder(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  } catch {
    return null;
  }
}

function getDiagnostics(
  state: ScannerDiagnostics,
  video: HTMLVideoElement,
  startedAt: number,
): ScannerDiagnostics {
  const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
  return {
    ...state,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    fps: Math.round(state.framesRead / elapsedSeconds),
  };
}

export function createScanner(
  video: HTMLVideoElement,
  options: ScannerOptions,
  dependenciesOverride: Partial<ScannerDependencies> = {},
) {
  const dependencies: ScannerDependencies = { ...defaultDependencies, ...dependenciesOverride };
  let frameId = 0;
  let active = false;
  let nativeDetector: BarcodeDetectorLike | null = null;
  let qrDecoder: JsQr | null = null;
  let busy = false;
  let lastReadAt = 0;
  let noReadFrames = 0;
  let lastMetricAt = 0;
  let frameSource: "video" | "animation" = "animation";
  type VideoFrameVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: (now: number) => void) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };
  const frameVideo = video as VideoFrameVideo;
  const requestFrame = (callback: FrameRequestCallback) => {
    if (frameVideo.requestVideoFrameCallback) {
      frameSource = "video";
      return frameVideo.requestVideoFrameCallback((now) => callback(now));
    }
    frameSource = "animation";
    return dependencies.requestFrame(callback);
  };
  const cancelFrame = (id: number) => {
    if (frameSource === "video" && frameVideo.cancelVideoFrameCallback) {
      frameVideo.cancelVideoFrameCallback(id);
    } else {
      dependencies.cancelFrame(id);
    }
  };
  const canvas = dependencies.createCanvas();
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const startedAt = dependencies.now();
  const diagnostics: ScannerDiagnostics = {
    decoder: "loading",
    nativeSupported: false,
    videoWidth: 0,
    videoHeight: 0,
    fps: 0,
    framesRead: 0,
    decodeErrors: 0,
    lastError: "",
    lastRawText: "",
  };

  const report = () => options.onDiagnostics?.(getDiagnostics(diagnostics, video, startedAt));
  const readCanvas = (x: number, y: number, width: number, height: number): ImageData => {
    canvas.width = width;
    canvas.height = height;
    context!.drawImage(video, x, y, width, height);
    return context!.getImageData(0, 0, width, height);
  };

  const decode = async () => {
    if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
    const ratio = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * ratio));
    const height = Math.max(1, Math.round(video.videoHeight * ratio));
    try {
      diagnostics.framesRead += 1;
      if (nativeDetector) {
        const result = (await nativeDetector.detect(video))[0];
        if (active && result?.rawValue) {
          diagnostics.lastRawText = result.rawValue.slice(0, 160);
          await options.onDecode(result);
          noReadFrames = 0;
          return;
        }
      } else if (qrDecoder) {
        let text = decodeFrame(readCanvas(0, 0, width, height), qrDecoder);
        noReadFrames += 1;
        if (!text && noReadFrames % 10 === 0) {
          const cropSize = Math.min(video.videoWidth, video.videoHeight, 960);
          const x = Math.round((video.videoWidth - cropSize) / 2);
          const y = Math.round((video.videoHeight - cropSize) / 2);
          const cropScale = Math.min(1, 960 / cropSize);
          text = decodeFrame(readCanvas(x, y, Math.round(cropSize * cropScale), Math.round(cropSize * cropScale)), qrDecoder);
        }
        if (active && text) {
          diagnostics.lastRawText = text.slice(0, 160);
          noReadFrames = 0;
          await options.onDecode({ rawValue: text, format: "qr_code" });
        }
      }
      diagnostics.lastError = "";
    } catch (error) {
      diagnostics.decodeErrors += 1;
      diagnostics.lastError = error instanceof Error ? error.name : "UnknownError";
      if (nativeDetector) {
        nativeDetector = null;
        diagnostics.decoder = "loading";
        try {
          qrDecoder = await dependencies.loadJsQr();
          diagnostics.decoder = "jsqr";
        } catch (loadError) {
          diagnostics.lastError = loadError instanceof Error ? loadError.name : "DecoderLoadError";
        }
      }
    } finally {
      if (dependencies.now() - lastMetricAt >= 500) {
        lastMetricAt = dependencies.now();
        report();
      }
    }
  };

  const tick: FrameRequestCallback = (time) => {
    if (!active) return;
    frameId = requestFrame(tick);
    if (busy || time - lastReadAt < 125) return;
    lastReadAt = time;
    busy = true;
    void decode().finally(() => {
      busy = false;
    });
  };

  return {
    async start() {
      if (active) return;
      active = true;
      try {
        nativeDetector = await dependencies.getNativeDetector();
        diagnostics.nativeSupported = nativeDetector !== null;
      } catch (error) {
        diagnostics.lastError = error instanceof Error ? error.name : "DetectorInitError";
      }
      if (!nativeDetector) {
        qrDecoder = await dependencies.loadJsQr();
        diagnostics.decoder = "jsqr";
      } else {
        diagnostics.decoder = "native";
      }
      report();
      if (active) frameId = requestFrame(tick);
    },
    stop() {
      active = false;
      cancelFrame(frameId);
    },
    getDiagnostics() {
      return getDiagnostics(diagnostics, video, startedAt);
    },
  };
}
