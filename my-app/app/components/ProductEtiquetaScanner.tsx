"use client";

import { useEffect, useRef, useState } from "react";
import {
  cameraErrorMessage,
  requestScannerStream,
  shouldAcceptScan,
  stopCameraStream,
} from "../../lib/qr/camera-utils";

type BarcodeDetection = { rawValue: string; format: string };
type NativeBarcodeDetector = {
  detect(source: CanvasImageSource): Promise<BarcodeDetection[]>;
};
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

export default function ProductEtiquetaScanner({
  onRead,
  onClose,
}: {
  onRead: (raw: string, format: string) => Promise<string>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);
  const previousRef = useRef<{ value: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("Aponte a câmera para o QR da etiqueta.");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const decodingRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    let frameId = 0;
    let lastFrameAt = 0;
    let detector: NativeBarcodeDetector | null = null;
    let jsQr: typeof import("jsqr").default | null = null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const start = async () => {
      try {
        const stream = await requestScannerStream(
          navigator.mediaDevices,
          window.isSecureContext || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname),
        );
        if (!activeRef.current) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] } | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
        if (capabilities?.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        }
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detectorConstructor = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (detectorConstructor) {
          const supported = await detectorConstructor.getSupportedFormats?.() ?? [];
          if (supported.includes("qr_code")) detector = new detectorConstructor({ formats: ["qr_code"] });
        }
        if (!detector) {
          jsQr = (await import("jsqr")).default;
        }

        const scan = async (time: number) => {
          if (!activeRef.current) return;
          frameId = window.requestAnimationFrame(scan);
          if (time - lastFrameAt < 100 || busyRef.current || decodingRef.current || !context || !videoRef.current) return;
          lastFrameAt = time;
          const video = videoRef.current;
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;

          decodingRef.current = true;
          try {
            let detected: BarcodeDetection | undefined;
            if (detector) {
              detected = (await detector.detect(video))[0];
            } else if (jsQr) {
              const ratio = Math.min(1, 1280 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * ratio);
              canvas.height = Math.round(video.videoHeight * ratio);
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQr(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
              if (result) detected = { rawValue: result.data, format: "qr_code" };
            }
            if (!detected?.rawValue || !shouldAcceptScan(detected.rawValue, Date.now(), previousRef.current)) return;

            previousRef.current = { value: detected.rawValue, at: Date.now() };
            busyRef.current = true;
            setFeedback("Etiqueta lida. Conferindo código…");
            if ("vibrate" in navigator) navigator.vibrate(100);
            const message = await onRead(detected.rawValue, detected.format);
            if (activeRef.current) setFeedback(message);
            window.setTimeout(() => { busyRef.current = false; }, 500);
          } catch {
            if (activeRef.current) setFeedback("Não foi possível decodificar o QR. Mantenha a etiqueta próxima e tente novamente.");
            busyRef.current = false;
          } finally {
            decodingRef.current = false;
          }
        };
        frameId = window.requestAnimationFrame(scan);
      } catch (cause) {
        if (activeRef.current) setError(cameraErrorMessage(cause));
      }
    };

    void start();
    return () => {
      activeRef.current = false;
      window.cancelAnimationFrame(frameId);
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, [onRead, retryKey]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((current) => !current);
    } catch {
      setFeedback("A lanterna não pôde ser ativada neste aparelho.");
    }
  }

  function retryCamera() {
    setError("");
    setFeedback("Aponte a câmera para o QR da etiqueta.");
    previousRef.current = null;
    busyRef.current = false;
    setRetryKey((value) => value + 1);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scanner-title" className="fixed inset-0 z-50 flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-4">
        <div>
          <h2 id="scanner-title" className="text-lg font-bold">Ler etiqueta</h2>
          <p className="text-sm text-slate-300">QR do código ERP/TOTVS</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold" aria-label="Fechar câmera">Fechar</button>
      </header>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-full w-full object-contain" aria-label="Prévia da câmera traseira" />
        {!error && <div aria-hidden="true" className="pointer-events-none absolute h-48 w-64 rounded-2xl border-4 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] sm:h-56 sm:w-80" />}
        {error && <div role="alert" className="absolute mx-5 max-w-lg rounded-xl bg-white p-5 text-slate-900 shadow-xl"><p>{error}</p><button type="button" onClick={retryCamera} className="mt-4 rounded-lg bg-royal px-4 py-2 font-semibold text-white">Tentar novamente</button></div>}
      </div>
      <footer className="space-y-3 px-4 py-4">
        <p aria-live="polite" className="text-center text-sm">{feedback}</p>
        <button type="button" onClick={() => void toggleTorch()} disabled={!torchSupported} className="mx-auto block rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-40">
          {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
        </button>
      </footer>
    </div>
  );
}
