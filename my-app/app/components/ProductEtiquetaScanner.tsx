"use client";

import { useEffect, useRef, useState } from "react";
import { createScanner, type ScannerDiagnostics } from "../../lib/qr/decoder";
import {
  cameraErrorMessage,
  createCameraLease,
  createScannerSession,
  isSuccessfulScannerFeedback,
  requestScannerStream,
  shouldAcceptScan,
} from "../../lib/qr/camera-utils";

export default function ProductEtiquetaScanner({
  onRead,
  onClose,
}: {
  onRead: (raw: string, format: string) => Promise<string>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousRef = useRef<{ value: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const unlockTimerRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("Procurando QR… Aponte a câmera para a etiqueta.");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [debug, setDebug] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [parserResult, setParserResult] = useState("");
  const scannerRef = useRef<ReturnType<typeof createScanner> | null>(null);
  const sessionRef = useRef<ReturnType<typeof createScannerSession> | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const setScannerActive = (active: boolean) => {
      if (active) document.documentElement.dataset.qrScannerActive = "true";
      else delete document.documentElement.dataset.qrScannerActive;
      window.dispatchEvent(new Event("marcon:qr-scanner-change"));
    };
    setScannerActive(true);
    const lease = createCameraLease();
    const video = videoRef.current;
    if (!video) {
      setScannerActive(false);
      return;
    }
    const session = createScannerSession(video, lease, setScannerActive, () => onCloseRef.current());
    sessionRef.current = session;
    let effectStream: MediaStream | null = null;
    let effectScanner: ReturnType<typeof createScanner> | null = null;
    queueMicrotask(() => setDebug(new URLSearchParams(window.location.search).get("debug") === "1"));

    const start = async () => {
      try {
        const stream = await requestScannerStream(
          navigator.mediaDevices,
          window.isSecureContext || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname),
        );
        if (!lease.attach(stream)) return;
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
        if (!lease.isActive()) return;
        video.srcObject = stream;
        await video.play();
        if (!lease.isActive()) return;
        const scanner = createScanner(video, {
          onDiagnostics: setDiagnostics,
          onDecode: async (detected) => {
            if (!lease.isActive() || session.hasSucceeded() || busyRef.current || !shouldAcceptScan(detected.rawValue, Date.now(), previousRef.current)) return;
            previousRef.current = { value: detected.rawValue, at: Date.now() };
            busyRef.current = true;
            setFeedback(`QR lido (${detected.rawValue.slice(0, 50)}). Conferindo…`);
            if ("vibrate" in navigator) navigator.vibrate(100);
            let succeeded = false;
            try {
              const message = await onRead(detected.rawValue, detected.format);
              if (lease.isActive()) {
                setFeedback(message);
                setParserResult(message);
                succeeded = session.completeSuccess(message);
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
        if (lease.isActive()) setError(cameraErrorMessage(cause));
        session.dispose();
        const stream = effectStream;
        if (streamRef.current === stream) streamRef.current = null;
      }
    };

    void start();
    return () => {
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
      session.dispose();
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
        <button type="button" onClick={() => sessionRef.current?.close()} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold" aria-label="Fechar câmera">Fechar</button>
      </header>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-full w-full object-contain" aria-label="Prévia da câmera traseira" />
        {!error && <div aria-hidden="true" className="pointer-events-none absolute h-48 w-64 rounded-2xl border-4 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] sm:h-56 sm:w-80" />}
        {error && <div role="alert" className="absolute mx-5 max-w-lg rounded-xl bg-white p-5 text-slate-900 shadow-xl"><p>{error}</p><button type="button" onClick={retryCamera} className="mt-4 rounded-lg bg-royal px-4 py-2 font-semibold text-white">Tentar novamente</button></div>}
      </div>
      <footer className="space-y-3 px-4 py-4">
        <p aria-live="polite" className={`text-center text-sm ${isSuccessfulScannerFeedback(feedback) ? "rounded-lg bg-emerald-900 p-3 font-semibold text-emerald-100" : ""}`}>{feedback}</p>
        <form
          className="mx-auto flex max-w-lg gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!manualValue.trim() || busyRef.current || sessionRef.current?.hasSucceeded()) return;
            busyRef.current = true;
            try {
              const message = await onRead(manualValue, "manual");
              setFeedback(message);
              setParserResult(message);
              setManualValue("");
              if (sessionRef.current?.completeSuccess(message)) return;
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
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 text-white placeholder:text-slate-400"
          />
          <button type="submit" disabled={!manualValue.trim()} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
            Conferir
          </button>
        </form>
        {debug && diagnostics && (
          <section aria-label="Diagnóstico da leitura QR" className="mx-auto grid max-w-2xl grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 sm:grid-cols-3">
            <p>Decoder: {diagnostics.decoder}</p>
            <p>BarcodeDetector QR: {diagnostics.nativeSupported ? "sim" : "não"}</p>
            <p>Vídeo: {diagnostics.videoWidth}×{diagnostics.videoHeight}</p>
            <p>FPS leitura: {diagnostics.fps}</p>
            <p>Frames: {diagnostics.framesRead}</p>
            <p>Erros: {diagnostics.decodeErrors} {diagnostics.lastError}</p>
            <p className="col-span-2 break-all sm:col-span-3">Último QR: {diagnostics.lastRawText || "—"}</p>
            <p className="col-span-2 break-all sm:col-span-3">Resultado do parser: {parserResult || "—"}</p>
          </section>
        )}
        <button type="button" onClick={() => void toggleTorch()} disabled={!torchSupported} className="mx-auto block rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-40">
          {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
        </button>
      </footer>
    </div>
  );
}
