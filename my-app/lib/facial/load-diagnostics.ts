export type FaceLoadStage = "idle" | "checando-backend" | "baixando-modelo" | "aquecendo" | "pronto" | "lento" | "erro";
export type FaceLoadUiState = "idle" | "loading" | "ready" | "slow" | "error";
export type FaceBackendName = "webgl" | "wasm" | "cpu";
export type FaceLoadUiEvent = "start" | "slow" | "timeout" | "success" | "failure";

export type FaceBackendAttempt = {
  backend: FaceBackendName;
  result: "trying" | "success" | "error" | "skipped";
  elapsedMs: number;
  errorName?: string;
  errorMessage?: string;
};

export type FaceModelAsset = {
  model: string;
  url: string;
  status: number | null;
  bytes: number;
  downloadedBytes?: number;
  elapsedMs: number;
  errorName?: string;
  errorMessage?: string;
};

export type FaceCameraAttempt = {
  constraints: MediaStreamConstraints;
  elapsedMs: number;
  result: "success" | "error";
  errorName?: string;
  errorMessage?: string;
};

export type FaceLoadDiagnostics = {
  stage: FaceLoadStage;
  startedAt: number | null;
  elapsedMs: number;
  completedBytes: number;
  totalBytes: number;
  backendAttempts: FaceBackendAttempt[];
  models: FaceModelAsset[];
  cameraAttempts: FaceCameraAttempt[];
  loadError?: { errorName: string; errorMessage: string };
};

export const faceModelFiles = {
  detector: ["blazeface.json", "blazeface.bin"],
  mesh: ["facemesh.json", "facemesh.bin"],
  descriptor: ["mobileface.json", "mobileface.bin"],
  emotion: ["emotion.json", "emotion.bin"],
} as const;

export const faceLoadTimeouts = {
  slowMs: 15_000,
  hardMs: 60_000,
} as const;

export function createFaceLoadDiagnostics(): FaceLoadDiagnostics {
  return {
    stage: "idle",
    startedAt: null,
    elapsedMs: 0,
    completedBytes: 0,
    totalBytes: 0,
    backendAttempts: [],
    models: [],
    cameraAttempts: [],
  };
}

export function transitionFaceLoadState(state: FaceLoadUiState, event: FaceLoadUiEvent): FaceLoadUiState {
  if (event === "start") return "loading";
  if (event === "success") return "ready";
  if (event === "timeout" || event === "failure") return "error";
  if (event === "slow" && state === "loading") return "slow";
  return state;
}

export function safeErrorDetails(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown };
    return {
      errorName: typeof candidate.name === "string" ? candidate.name : "UnknownError",
      errorMessage: typeof candidate.message === "string" ? candidate.message : "Falha sem mensagem.",
    };
  }
  return { errorName: "UnknownError", errorMessage: "Falha sem mensagem." };
}

export function faceModelAssetUrl(file: string) {
  if (!Object.values(faceModelFiles).some((files) => (files as readonly string[]).includes(file))) {
    throw new Error("Arquivo de modelo não permitido.");
  }
  return `/models/human/${file}`;
}

export function addFaceModelAsset(
  current: FaceLoadDiagnostics,
  asset: FaceModelAsset,
): FaceLoadDiagnostics {
  const models = current.models.filter((item) => item.model !== asset.model);
  models.push(asset);
  return {
    ...current,
    models,
    completedBytes: models.reduce((sum, item) => sum + (item.downloadedBytes ?? (item.status !== null && item.status >= 200 && item.status < 300 ? item.bytes : 0)), 0),
    totalBytes: Math.max(current.totalBytes, models.reduce((sum, item) => sum + item.bytes, 0)),
  };
}

export function withFaceLoadError(current: FaceLoadDiagnostics, error: unknown): FaceLoadDiagnostics {
  return { ...current, loadError: safeErrorDetails(error) };
}

export function addFaceBackendAttempt(
  current: FaceLoadDiagnostics,
  attempt: FaceBackendAttempt,
): FaceLoadDiagnostics {
  const backendAttempts = current.backendAttempts.filter((item) => item.backend !== attempt.backend);
  backendAttempts.push(attempt);
  return { ...current, backendAttempts };
}

export function addFaceCameraAttempt(
  current: FaceLoadDiagnostics,
  attempt: FaceCameraAttempt,
): FaceLoadDiagnostics {
  return { ...current, cameraAttempts: [...current.cameraAttempts, attempt] };
}

export function faceLoadProgress(diagnostics: FaceLoadDiagnostics) {
  if (diagnostics.stage === "pronto") return 100;
  if (diagnostics.totalBytes > 0) return Math.min(90, Math.round(diagnostics.completedBytes / diagnostics.totalBytes * 90));
  return diagnostics.stage === "checando-backend" ? 5 : diagnostics.stage === "aquecendo" ? 95 : 0;
}

export function startFaceLoadWatchdog(
  onSlow: () => void,
  onTimeout: () => void,
  timers: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis,
) {
  let timedOut = false;
  const slowTimer = timers.setTimeout(onSlow, faceLoadTimeouts.slowMs);
  const hardTimer = timers.setTimeout(() => {
    timedOut = true;
    onTimeout();
  }, faceLoadTimeouts.hardMs);
  return {
    didTimeout: () => timedOut,
    clear() {
      timers.clearTimeout(slowTimer);
      timers.clearTimeout(hardTimer);
    },
  };
}

export function faceCameraConstraintFallbacks(): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: true, audio: false },
  ];
}

export async function startCameraWithConstraintFallback<T>(
  start: (constraints: MediaStreamConstraints) => Promise<T>,
  constraintsList: readonly MediaStreamConstraints[] = faceCameraConstraintFallbacks(),
  onAttempt: (attempt: FaceCameraAttempt) => void = () => undefined,
  now: () => number = () => performance.now(),
): Promise<T> {
  let lastError: unknown = new Error("Nenhuma configuração de câmera foi tentada.");
  for (const constraints of constraintsList) {
    const startedAt = now();
    try {
      const value = await start(constraints);
      onAttempt({ constraints, elapsedMs: Math.round(now() - startedAt), result: "success" });
      return value;
    } catch (error) {
      lastError = error;
      onAttempt({ constraints, elapsedMs: Math.round(now() - startedAt), result: "error", ...safeErrorDetails(error) });
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") throw error;
    }
  }
  throw lastError;
}

export function createPrivacySafeDiagnostics(diagnostics: FaceLoadDiagnostics) {
  return {
    ...diagnostics,
    models: diagnostics.models.map(({ model, url, status, bytes, downloadedBytes, elapsedMs, errorName, errorMessage }) => ({
      model,
      url,
      status,
      bytes,
      downloadedBytes: downloadedBytes ?? bytes,
      elapsedMs,
      ...(errorName ? { errorName } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    })),
    cameraAttempts: diagnostics.cameraAttempts.map((attempt) => ({
      constraints: attempt.constraints,
      elapsedMs: attempt.elapsedMs,
      result: attempt.result,
      ...(attempt.errorName ? { errorName: attempt.errorName } : {}),
      ...(attempt.errorMessage ? { errorMessage: attempt.errorMessage } : {}),
    })),
  };
}

export function createSingletonLoader<T>() {
  let promise: Promise<T> | null = null;
  return {
    load(factory: () => Promise<T>) {
      if (!promise) {
        promise = factory().catch((error: unknown) => {
          promise = null;
          throw error;
        });
      }
      return promise;
    },
    clear() {
      promise = null;
    },
  };
}

export async function runFaceBackendFallback<T>(
  backends: readonly FaceBackendName[],
  attempt: (backend: FaceBackendName) => Promise<T>,
  onAttempt: (attempt: FaceBackendAttempt) => void,
  now: () => number = () => performance.now(),
): Promise<{ backend: FaceBackendName; value: T }> {
  let lastError: unknown = new Error("Nenhum backend compatível está disponível.");
  for (const backend of backends) {
    const startedAt = now();
    onAttempt({ backend, result: "trying", elapsedMs: 0 });
    try {
      const value = await attempt(backend);
      onAttempt({ backend, result: "success", elapsedMs: Math.round(now() - startedAt) });
      return { backend, value };
    } catch (error) {
      lastError = error;
      onAttempt({
        backend,
        result: "error",
        elapsedMs: Math.round(now() - startedAt),
        ...safeErrorDetails(error),
      });
    }
  }
  throw lastError;
}
