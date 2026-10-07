"use client";

import { useEffect, useRef, useState } from "react";
import { createScanner, type ScannerDiagnostics } from "../../lib/qr/decoder";
import {
  createCameraStreamController,
  type CameraLifecycleReason,
  type CameraState,
} from "../../lib/camera/camera-stream";
import {
  cameraErrorMessage,
  createScannerSession,
  requestScannerStream,
  shouldCloseCamera,
  shouldAcceptScan,
  type ScannerReadKind,
  type ScannerReadResult,
} from "../../lib/qr/camera-utils";
import BuildIdentifier from "./BuildIdentifier";
import { Icon } from "./ui";

export default function ProductEtiquetaScanner({
  onRead,
  onClose,
}: {
  onRead: (raw: string, format: string) => Promise<ScannerReadResult>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousRef = useRef<{ value: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const unlockTimerRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("Procurando QR… Aponte a câmera para a etiqueta.");
  const [successFeedback, setSuccessFeedback] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<ScannerReadKind>("error");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [debug, setDebug] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [lastLifecycleReason, setLastLifecycleReason] = useState<CameraLifecycleReason | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const [manualValue, setManualValue] = useState("");
  const scannerRef = useRef<ReturnType<typeof createScanner> | null>(null);
  const sessionRef = useRef<ReturnType<typeof createScannerSession> | null>(null);
  const onCloseRef = useRef(onClose);
  const diagnosticsEnabledRef = useRef(false);
  const terminalReadRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let effectActive = true;
    const setScannerActive = (active: boolean) => {
      if (active) document.documentElement.dataset.qrScannerActive = "true";
      else delete document.documentElement.dataset.qrScannerActive;
      window.dispatchEvent(new Event("marcon:qr-scanner-change"));
    };
    setScannerActive(true);
    const video = videoRef.current;
    if (!video) {
      setScannerActive(false);
      return;
    }
    const secureContext = window.isSecureContext || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const camera = createCameraStreamController({
      video,
      mediaDevices: {
        getUserMedia: () => requestScannerStream(navigator.mediaDevices, secureContext),
      },
      secureContext,
      onStateChange: (state) => {
        if (effectActive) setCameraState(state);
      },
      onLifecycleStop: (reason) => {
        if (diagnosticsEnabledRef.current) setLastLifecycleReason(reason);
        sessionRef.current?.close();
      },
    });
    const session = createScannerSession(video, camera, setScannerActive, () => onCloseRef.current());
    sessionRef.current = session;
    let effectStream: MediaStream | null = null;
    let effectScanner: ReturnType<typeof createScanner> | null = null;
    queueMicrotask(() => {
      if (!effectActive) return;
      const enabled = new URLSearchParams(window.location.search).get("debug") === "1";
      diagnosticsEnabledRef.current = enabled;
      setDebug(enabled);
    });

    const start = async () => {
      try {
        const stream = await camera.start({ video: true, audio: false });
        effectStream = stream;
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] } | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
        if (capabilities?.focusMode?.includes("continuous")) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
          } catch {
            setFeedback("Foco contínuo indisponível. Aproxime a etiqueta até o QR ficar nítido.");
          }
        }
        if (!camera.isActive()) return;
        const scanner = createScanner(video, {
          onDiagnostics: (next) => {
            if (effectActive) setDiagnostics(next);
          },
          onDecode: async (detected) => {
            if (!camera.isActive() || terminalReadRef.current || session.hasSucceeded() || busyRef.current || !shouldAcceptScan(detected.rawValue, Date.now(), previousRef.current)) return;
            previousRef.current = { value: detected.rawValue, at: Date.now() };
            busyRef.current = true;
            setFeedback(`QR lido (${detected.rawValue.slice(0, 50)}). Conferindo…`);
            if ("vibrate" in navigator) navigator.vibrate(100);
            let succeeded = false;
            try {
              const result = await onRead(detected.rawValue, detected.format);
              if (shouldCloseCamera(result.kind)) terminalReadRef.current = true;
              if (camera.isActive()) {
                setFeedback(result.message);
                setFeedbackKind(result.kind);
                setSuccessFeedback(result.kind === "confirmed");
                succeeded = session.completeRead(shouldCloseCamera(result.kind));
              }
            } finally {
              if (!succeeded) {
                unlockTimerRef.current = window.setTimeout(() => {
                  unlockTimerRef.current = null;
                  busyRef.current = false;
                }, 500);
              }
            }
          },
        });
        effectScanner = scanner;
        scannerRef.current = scanner;
        session.setScanner(scanner);
        await scanner.start();
      } catch (cause) {
        if (effectActive && !(cause instanceof DOMException && cause.name === "AbortError")) setError(cameraErrorMessage(cause));
        session.dispose();
        camera.dispose();
        const stream = effectStream;
        if (streamRef.current === stream) streamRef.current = null;
      }
    };

    void start();
    return () => {
      effectActive = false;
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
      session.dispose();
      camera.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
      if (scannerRef.current === effectScanner) scannerRef.current = null;
      if (streamRef.current === effectStream) streamRef.current = null;
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
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = null;
    setError("");
    setFeedback("Procurando QR… Aponte a câmera para a etiqueta.");
    setSuccessFeedback(false);
    setFeedbackKind("error");
    terminalReadRef.current = false;
    previousRef.current = null;
    busyRef.current = false;
    setRetryKey((value) => value + 1);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scanner-title" className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-foreground text-white">
      <header className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div>
          <h2 id="scanner-title" className="text-lg font-bold">Ler etiqueta</h2>
          <p className="text-sm text-white/80">QR do código ERP/TOTVS</p>
        </div>
        <button type="button" onClick={() => sessionRef.current?.close()} className="min-h-11 rounded-lg border border-white/40 px-4 font-semibold" aria-label="Fechar câmera"><Icon name="close" /> Fechar</button>
      </header>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-foreground">
        <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-full w-full object-contain" aria-label="Prévia da câmera traseira" />
        {!error && <div aria-hidden="true" className="pointer-events-none absolute h-48 w-64 rounded-2xl border-4 border-success shadow-[0_0_0_9999px_var(--ui-shadow-scrim)] sm:h-56 sm:w-80" />}
        {error && <div role="alert" className="absolute mx-5 max-w-lg rounded-xl bg-white p-5 text-foreground shadow-overlay"><p>{error}</p><button type="button" onClick={retryCamera} className="mt-4 min-h-11 rounded-lg bg-brand px-4 font-semibold text-white">Tentar novamente</button></div>}
      </div>
      <footer className="space-y-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p aria-live="polite" className={`text-center text-sm ${successFeedback ? "rounded-lg bg-success p-3 font-semibold text-white" : feedbackKind === "already-confirmed" ? "rounded-lg bg-priority-surface p-3 font-semibold text-brand" : "text-white"}`}>
          {feedbackKind === "already-confirmed" ? <><span aria-hidden="true">ℹ </span><span>Informação: </span></> : null}{feedback}
        </p>
        <BuildIdentifier />
        <form
          className="mx-auto flex max-w-lg gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!manualValue.trim() || busyRef.current || terminalReadRef.current || sessionRef.current?.hasSucceeded()) return;
            busyRef.current = true;
            try {
              const result = await onRead(manualValue, "manual");
              if (shouldCloseCamera(result.kind)) terminalReadRef.current = true;
              setFeedback(result.message);
              setFeedbackKind(result.kind);
              setSuccessFeedback(result.kind === "confirmed");
              setManualValue("");
              if (sessionRef.current?.completeRead(shouldCloseCamera(result.kind))) return;
            } finally {
              if (!sessionRef.current?.hasSucceeded()) busyRef.current = false;
            }
          }}
        >
          <label htmlFor="scanner-manual-code" className="sr-only">Digitar código da etiqueta</label>
          <input
            id="scanner-manual-code"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Ou digite o código"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/40 bg-foreground px-3 text-white placeholder:text-white/70"
          />
          <button type="submit" disabled={!manualValue.trim()} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover active:bg-brand-pressed disabled:opacity-50">
            Conferir
          </button>
        </form>
        {debug && diagnostics && (
          <section aria-label="Diagnóstico da leitura QR" className="mx-auto grid max-w-2xl grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-border-subtle p-3 text-xs text-text-secondary sm:grid-cols-3">
            <p>Decoder: {diagnostics.decoder}</p>
            <p>Câmera: {cameraState}</p>
            <p>Fechamento: {lastLifecycleReason ?? "—"}</p>
            <p>BarcodeDetector QR: {diagnostics.nativeSupported ? "sim" : "não"}</p>
            <p>Vídeo: {diagnostics.videoWidth}×{diagnostics.videoHeight}</p>
            <p>FPS leitura: {diagnostics.fps}</p>
            <p>Frames: {diagnostics.framesRead}</p>
            <p>Erros: {diagnostics.decodeErrors} {diagnostics.lastError}</p>
            <p className="col-span-2 sm:col-span-3">QR: {diagnostics.lastRawText ? "leitura detectada" : "aguardando leitura"}</p>
          </section>
        )}
        <button type="button" onClick={() => void toggleTorch()} disabled={!torchSupported} className="mx-auto block min-h-11 rounded-lg border border-white/40 px-4 text-sm font-semibold disabled:opacity-40">
          {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
        </button>
      </footer>
    </div>
  );
}
