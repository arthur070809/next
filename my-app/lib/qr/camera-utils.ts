export type CameraTrackLike = Pick<MediaStreamTrack, "stop">;
export type CameraStreamLike = { getTracks(): CameraTrackLike[] };
export const SCANNER_SUCCESS_FEEDBACK_MS = 650;

export const scannerVideoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

export async function requestScannerStream(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined,
  secureContext: boolean,
): Promise<MediaStream> {
  if (!secureContext) {
    throw new DOMException("Câmera requer contexto seguro.", "SecurityError");
  }
  if (!mediaDevices?.getUserMedia) {
    throw new DOMException("Câmera indisponível.", "NotFoundError");
  }

  try {
    return await mediaDevices.getUserMedia({
      video: scannerVideoConstraints,
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "OverconstrainedError") {
      return mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw error;
  }
}

export function cameraErrorMessage(error: unknown, userAgent?: string): string {
  if (!(error instanceof Error)) return "Não foi possível iniciar a câmera.";
  const browser = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  const embeddedBrowser = /Instagram/i.test(browser)
    ? "Instagram"
    : /WhatsApp/i.test(browser)
      ? "WhatsApp"
      : /FBAN|FBAV/i.test(browser)
        ? "Facebook"
        : /Line\//i.test(browser)
          ? "LINE"
          : null;
  if (embeddedBrowser) return `O navegador integrado do ${embeddedBrowser} pode bloquear a câmera. Abra o link no Chrome, Safari ou outro navegador e permita o acesso à câmera.`;
  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador e tente novamente.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Nenhuma câmera foi encontrada neste aparelho.";
    case "NotReadableError":
    case "TrackStartError":
      return "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.";
    case "SecurityError":
      return "A câmera exige HTTPS ou acesso por localhost. Abra esta página em uma conexão segura.";
    case "OverconstrainedError":
      return "A câmera não suporta a configuração solicitada.";
    default:
      return "Não foi possível iniciar a câmera. Verifique a permissão e tente novamente.";
  }
}

export function shouldAcceptScan(
  value: string,
  now: number,
  lastScan: { value: string; at: number } | null,
  debounceMs = 2000,
): boolean {
  return !lastScan || lastScan.value !== value || now - lastScan.at >= debounceMs;
}

export function isSuccessfulScannerFeedback(message: string): boolean {
  return message.startsWith("Item conferido")
    || message.includes("já foi conferido")
    || message.startsWith("Item encontrado:")
    || (message.startsWith("Código ") && message.includes(" não cadastrado."));
}

export function stopCameraStream(stream: CameraStreamLike | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function createCameraLease() {
  let active = true;
  let stream: CameraStreamLike | null = null;
  return {
    isActive: () => active,
    attach(next: CameraStreamLike) {
      if (!active) {
        stopCameraStream(next);
        return false;
      }
      stream = next;
      return true;
    },
    close() {
      active = false;
      const ownedStream = stream;
      stream = null;
      stopCameraStream(ownedStream);
      return ownedStream;
    },
  };
}

export function createScannerSession(
  video: { srcObject: unknown },
  lease: ReturnType<typeof createCameraLease>,
  setActive: (active: boolean) => void,
  onClose: () => void,
) {
  let scanner: { stop(): void } | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let successful = false;
  let closed = false;

  const close = (notify: boolean) => {
    if (closed) return;
    closed = true;
    if (closeTimer !== null) clearTimeout(closeTimer);
    closeTimer = null;
    scanner?.stop();
    scanner = null;
    const stream = lease.close();
    if (video.srcObject === stream) video.srcObject = null;
    setActive(false);
    if (notify) onClose();
  };

  return {
    setScanner(next: { stop(): void }) {
      if (closed) next.stop();
      else scanner = next;
    },
    completeSuccess(message: string): boolean {
      if (closed || successful || !isSuccessfulScannerFeedback(message)) return false;
      successful = true;
      closeTimer = setTimeout(() => close(true), SCANNER_SUCCESS_FEEDBACK_MS);
      return true;
    },
    isClosed: () => closed,
    hasSucceeded: () => successful,
    close: () => close(true),
    dispose: () => close(false),
  };
}
