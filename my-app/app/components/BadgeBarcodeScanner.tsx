"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  BadgeScannerError,
  createBadgeCameraScanner,
} from "@/lib/barcode/badge-camera-scanner";

type CameraOption = { deviceId: string; label: string };

function cameraErrorMessage(error: unknown) {
  if (error instanceof BadgeScannerError) {
    if (error.reason === "unsupported") {
      return "Este navegador não oferece leitura de código de barras pela câmera. Digite o crachá manualmente.";
    }
    if (error.reason === "insecure") {
      return "A câmera exige uma conexão HTTPS segura. Digite o crachá manualmente.";
    }
    return "Câmera indisponível neste aparelho. Digite o crachá manualmente.";
  }
  if (error instanceof DOMException) {
    if (["NotAllowedError", "PermissionDeniedError"].includes(error.name)) {
      return "A permissão da câmera foi negada. Libere o acesso ou digite o crachá manualmente.";
    }
    if (error.name === "NotFoundError") {
      return "Nenhuma câmera foi encontrada. Digite o crachá manualmente.";
    }
    if (["NotReadableError", "TrackStartError"].includes(error.name)) {
      return "A câmera está ocupada por outro aplicativo. Feche-o ou digite o crachá manualmente.";
    }
    if (error.name === "OverconstrainedError") {
      return "Esta câmera não está disponível. Escolha outra ou digite o crachá manualmente.";
    }
    if (error.name === "SecurityError") {
      return "A câmera exige uma conexão HTTPS segura. Digite o crachá manualmente.";
    }
  }
  return "Não foi possível iniciar a câmera. Tente novamente ou digite o crachá manualmente.";
}

export default function BadgeBarcodeScanner({
  onDetect,
  label,
  validate,
  onManual,
}: {
  onDetect: (value: string) => void;
  label: string;
  validate: (value: string) => boolean;
  onManual?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<ReturnType<typeof createBadgeCameraScanner> | null>(null);
  const validateRef = useRef(validate);
  const onDetectRef = useRef(onDetect);
  const onManualRef = useRef(onManual);
  const restoreFocusRef = useRef(true);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    validateRef.current = validate;
    onDetectRef.current = onDetect;
    onManualRef.current = onManual;
  }, [validate, onDetect, onManual]);

  const closePanel = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    scannerRef.current?.stop();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        if (restoreFocusRef.current) triggerRef.current?.focus();
        wasOpenRef.current = false;
        restoreFocusRef.current = true;
      }
      return;
    }

    wasOpenRef.current = true;
    closeRef.current?.focus();
    let mounted = true;
    const scanner = createBadgeCameraScanner({
      video: dialogRef.current?.querySelector("video") as HTMLVideoElement,
      validate: (value) => validateRef.current(value),
      onDetect: (value) => {
        closePanel(false);
        onDetectRef.current(value);
      },
      onInvalid: () => setError("Código não reconhecido, tente de novo ou digite."),
      onError: (cause) => setError(cameraErrorMessage(cause)),
    });
    scannerRef.current = scanner;
    void scanner.start(cameraId || undefined).then(async () => {
      if (!mounted) return;
      setMessage("Aponte a câmera para o código de barras do crachá.");
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices();
        if (!mounted || !devices) return;
        setCameras(devices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Câmera ${index + 1}`,
          })));
      } catch {
        if (mounted) setMessage("Não foi possível listar as outras câmeras; a leitura continua com a traseira preferida.");
      }
    }).catch((cause: unknown) => {
      if (mounted) setError(cameraErrorMessage(cause));
    });

    return () => {
      mounted = false;
      scanner.stop();
      if (scannerRef.current === scanner) scannerRef.current = null;
    };
  }, [open, cameraId, closePanel]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function useManualEntry() {
    closePanel(false);
    onManualRef.current?.();
  }

  function openPanel() {
    setError("");
    setMessage("Preparando câmera…");
    setCameras([]);
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className="min-h-11 shrink-0 rounded-control border border-brand px-3 py-2 text-sm font-semibold text-brand transition-colors hover:bg-priority-surface active:bg-brand/10"
        aria-label={label}
      >
        Ler crachá
      </button>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-scanner-title"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="safe-area-inset fixed inset-0 z-[60] flex min-h-dvh flex-col bg-foreground text-surface"
        >
          <header className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
            <div className="min-w-0">
              <h2 id="badge-scanner-title" className="text-lg font-bold">Ler crachá</h2>
              <p className="text-sm text-surface/80">{label}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => closePanel()}
              className="min-h-11 shrink-0 rounded-control border border-surface/40 px-4 font-semibold"
            >
              Fechar
            </button>
          </header>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-foreground">
            <video
              autoPlay
              muted
              playsInline
              className="h-full max-h-full w-full object-contain"
              aria-label="Prévia da câmera para leitura do crachá"
            />
            {!error && <div aria-hidden="true" className="pointer-events-none absolute h-32 w-[min(90vw,36rem)] rounded-lg border-2 border-success sm:h-40" />}
          </div>
          <footer className="space-y-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p aria-live="polite" role={error ? "alert" : undefined} className={`text-center text-sm ${error ? "rounded-control bg-error-surface p-3 font-semibold text-error" : "text-surface"}`}>
              {error || message}
            </p>
            {cameras.length > 1 && (
              <label className="mx-auto block max-w-lg text-sm font-semibold">
                Câmera
                <select
                  value={cameraId}
                  onChange={(event) => {
                    setError("");
                    setMessage("Iniciando câmera selecionada…");
                    setCameraId(event.target.value);
                  }}
                  className="mt-1 min-h-11 w-full rounded-control border border-surface/40 bg-foreground px-3 text-base text-surface"
                >
                  <option value="">Preferir câmera traseira</option>
                  {cameras.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}
                </select>
              </label>
            )}
            {error && (
              <button
                type="button"
                onClick={useManualEntry}
                className="mx-auto block min-h-11 rounded-control bg-brand px-4 font-semibold text-surface"
              >
                Fechar leitor e digitar
              </button>
            )}
          </footer>
        </div>
      )}
    </>
  );
}
