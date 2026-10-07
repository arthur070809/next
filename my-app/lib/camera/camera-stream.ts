export type CameraState = "idle" | "starting" | "active" | "error" | "denied";
export type CameraLifecycleReason = "visibilitychange" | "pagehide";
type CameraStream = Pick<MediaStream, "getTracks">;
type CameraVideo = Pick<HTMLVideoElement, "srcObject" | "play" | "pause" | "removeAttribute">;
type CameraLifecycleTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type CameraStreamController = {
  start(constraints: MediaStreamConstraints): Promise<MediaStream>;
  stop(): void;
  close(): CameraStream | null;
  dispose(): void;
  registerCleanup(cleanup: () => void): () => void;
  getStream(): MediaStream | null;
  getState(): CameraState;
  isActive(): boolean;
};

export function stopMediaStream(stream: CameraStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function createCameraStreamController({
  video,
  mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices,
  secureContext = typeof window === "undefined" ? false : window.isSecureContext,
  visibilityTarget = typeof document === "undefined" || typeof document.addEventListener !== "function" ? undefined : document,
  pageTarget = typeof window === "undefined" || typeof window.addEventListener !== "function" ? undefined : window,
  isHidden = () => typeof document !== "undefined" && document.hidden,
  qrScannerMarker = false,
  onStateChange,
  onLifecycleStop,
}: {
  video: CameraVideo | null;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  secureContext?: boolean;
  visibilityTarget?: CameraLifecycleTarget;
  pageTarget?: CameraLifecycleTarget;
  isHidden?: () => boolean;
  qrScannerMarker?: boolean;
  onStateChange?: (state: CameraState) => void;
  onLifecycleStop?: (reason: CameraLifecycleReason) => void;
}): CameraStreamController {
  let state: CameraState = "idle";
  let stream: MediaStream | null = null;
  let pending: Promise<MediaStream> | null = null;
  let pendingGeneration: number | null = null;
  let generation = 0;
  let disposed = false;
  let markerOwned = false;
  const cleanups = new Set<() => void>();

  const updateState = (next: CameraState) => {
    state = next;
    onStateChange?.(next);
  };
  const markScannerActive = (active: boolean) => {
    if (!qrScannerMarker || markerOwned === active || typeof document === "undefined") return;
    markerOwned = active;
    if (active) {
      document.documentElement.dataset.qrScannerActive = "true";
    } else {
      delete document.documentElement.dataset.qrScannerActive;
    }
    window.dispatchEvent(new Event("marcon:qr-scanner-change"));
  };

  const stop = () => {
    if (state === "idle" && !pending && !stream && cleanups.size === 0 && !markerOwned) return;
    generation += 1;
    pending = null;
    pendingGeneration = null;
    for (const cleanup of [...cleanups]) cleanup();
    cleanups.clear();
    const ownedStream = stream;
    stream = null;
    stopMediaStream(ownedStream);
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
    }
    markScannerActive(false);
    updateState("idle");
  };

  const handleLifecycleStop = (reason: CameraLifecycleReason) => {
    stop();
    onLifecycleStop?.(reason);
  };
  const handleVisibilityChange = () => {
    if (isHidden()) handleLifecycleStop("visibilitychange");
  };
  const handlePageHide = () => handleLifecycleStop("pagehide");
  visibilityTarget?.addEventListener("visibilitychange", handleVisibilityChange);
  pageTarget?.addEventListener("pagehide", handlePageHide);

  const start = (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    if (disposed) return Promise.reject(new DOMException("Câmera encerrada.", "AbortError"));
    if (stream && state === "active") return Promise.resolve(stream);
    if (pending) return pending;
    const requestGeneration = ++generation;
    markScannerActive(true);
    updateState("starting");

    const request = Promise.resolve().then(async () => {
      try {
        if (!secureContext) throw new DOMException("Câmera requer HTTPS.", "SecurityError");
        if (!mediaDevices?.getUserMedia) throw new DOMException("Câmera indisponível.", "NotFoundError");
        const nextStream = await mediaDevices.getUserMedia(constraints);
        if (disposed || requestGeneration !== generation) {
          stopMediaStream(nextStream);
          throw new DOMException("Inicialização da câmera cancelada.", "AbortError");
        }
        stream = nextStream;
        if (video) {
          video.srcObject = nextStream;
          await video.play();
        }
        if (disposed || requestGeneration !== generation) {
          throw new DOMException("Inicialização da câmera cancelada.", "AbortError");
        }
        updateState("active");
        return nextStream;
      } catch (error) {
        if (!disposed && requestGeneration === generation) {
          const denied = error instanceof DOMException
            && ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error.name);
          stop();
          updateState(denied ? "denied" : "error");
        }
        throw error;
      } finally {
        if (pendingGeneration === requestGeneration) {
          pending = null;
          pendingGeneration = null;
        }
      }
    });
    pending = request;
    pendingGeneration = requestGeneration;
    return request;
  };

  const close = () => {
    const ownedStream = stream;
    stop();
    return ownedStream;
  };

  return {
    start,
    stop,
    close,
    dispose() {
      if (disposed) return;
      disposed = true;
      visibilityTarget?.removeEventListener("visibilitychange", handleVisibilityChange);
      pageTarget?.removeEventListener("pagehide", handlePageHide);
      stop();
    },
    registerCleanup(cleanup) {
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    },
    getStream: () => stream,
    getState: () => state,
    isActive: () => !disposed && state !== "idle" && state !== "error" && state !== "denied",
  };
}
