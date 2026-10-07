"use client";

import type Human from "@vladmandic/human";
import { faceEmbeddingDimension } from "./config";
import { FACE_QUALITY_LIMITS } from "./face-quality";
import {
  addFaceBackendAttempt,
  addFaceModelAsset,
  createFaceLoadDiagnostics,
  createSingletonLoader,
  faceModelAssetUrl,
  faceModelFiles,
  runFaceBackendFallback,
  safeErrorDetails,
  type FaceLoadDiagnostics,
} from "./load-diagnostics";

export type BrowserHuman = InstanceType<typeof Human>;
export type BrowserFace = Awaited<ReturnType<BrowserHuman["detect"]>>["face"][number];

function isHumanConstructor(candidate: unknown): candidate is typeof Human {
  return typeof candidate === "function";
}

type HumanLoaderCallbacks = {
  onProgress: (message: string) => void;
  onDiagnostics: (diagnostics: FaceLoadDiagnostics) => void;
};

const humanLoader = createSingletonLoader<{ human: BrowserHuman; backend: string }>();
const descriptorLoader = createSingletonLoader<void>();
const emotionLoader = createSingletonLoader<void>();
let optionalModelsQueue = Promise.resolve();
let sharedDiagnostics = createFaceLoadDiagnostics();
const callbackListeners = new Set<HumanLoaderCallbacks>();

function publishProgress(message: string) {
  callbackListeners.forEach((callbacks) => callbacks.onProgress(message));
}

function publishDiagnostics(diagnostics: FaceLoadDiagnostics) {
  sharedDiagnostics = diagnostics;
  callbackListeners.forEach((callbacks) => callbacks.onDiagnostics(diagnostics));
}

function sharedCallbacks(): HumanLoaderCallbacks {
  return { onProgress: publishProgress, onDiagnostics: publishDiagnostics };
}

async function verifyLocalModelFiles(
  files: readonly string[],
  callbacks: HumanLoaderCallbacks,
  diagnostics: FaceLoadDiagnostics,
) {
  await Promise.all(files.map(async (file) => {
    const startedAt = performance.now();
    const url = faceModelAssetUrl(file);
    try {
      const response = await fetch(url, { cache: "force-cache" });
      const expectedBytes = Number(response.headers.get("content-length")) || 0;
      diagnostics = { ...diagnostics, totalBytes: diagnostics.totalBytes + expectedBytes };
      diagnostics = addFaceModelAsset(diagnostics, {
        model: file,
        url,
        status: response.status,
        bytes: expectedBytes,
        downloadedBytes: 0,
        elapsedMs: 0,
      });
      callbacks.onDiagnostics(diagnostics);
      if (!response.ok) {
        diagnostics = addFaceModelAsset(diagnostics, {
          model: file,
          url,
          status: response.status,
          bytes: expectedBytes,
          downloadedBytes: 0,
          elapsedMs: Math.round(performance.now() - startedAt),
          errorName: "HttpError",
          errorMessage: `HTTP ${response.status}`,
        });
        callbacks.onDiagnostics(diagnostics);
        throw Object.assign(new Error(`${url}: HTTP ${response.status}`), { name: "HttpError" });
      }
      let bytes = 0;
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          diagnostics = addFaceModelAsset(diagnostics, {
            model: file,
            url,
            status: null,
            bytes: expectedBytes,
            downloadedBytes: bytes,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
          callbacks.onDiagnostics(diagnostics);
        }
      } else {
        bytes = (await response.arrayBuffer()).byteLength;
      }
      diagnostics = addFaceModelAsset(diagnostics, {
        model: file,
        url,
        status: response.status,
        bytes: expectedBytes || bytes,
        downloadedBytes: bytes,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      callbacks.onDiagnostics(diagnostics);
    } catch (error) {
      const prior = diagnostics.models.find((model) => model.model === file);
      diagnostics = addFaceModelAsset(diagnostics, {
        model: file,
        url,
        status: prior?.status ?? null,
        bytes: prior?.bytes ?? 0,
        downloadedBytes: prior?.downloadedBytes ?? 0,
        elapsedMs: Math.round(performance.now() - startedAt),
        ...safeErrorDetails(error),
      });
      callbacks.onDiagnostics(diagnostics);
      throw error;
    }
  }));
}

async function createBrowserHuman(callbacks: HumanLoaderCallbacks, diagnostics: FaceLoadDiagnostics) {
  callbacks.onProgress("Carregando o reconhecedor facial local");
  // The package root resolves to its Node entry during server-side rendering.
  const candidate: unknown = (await import("../../node_modules/@vladmandic/human/dist/human.esm.js")).default;
  if (!isHumanConstructor(candidate)) throw new Error("Local facial model could not be loaded.");
  const HumanLibrary = candidate;
  diagnostics = { ...diagnostics, stage: "baixando-modelo" };
  callbacks.onDiagnostics(diagnostics);
  callbacks.onProgress("Baixando detector e malha facial (modelos locais)");
  await verifyLocalModelFiles([...faceModelFiles.detector, ...faceModelFiles.mesh], callbacks, diagnostics);
  const config = {
    modelBasePath: "/models/human/",
    wasmPath: "/models/human/wasm/",
    cacheModels: true,
    debug: false,
    warmup: "face",
    face: {
      enabled: true,
      detector: {
        maxDetected: 2,
        minConfidence: FACE_QUALITY_LIMITS.minimumDetectionConfidence,
        rotation: true,
      },
      mesh: { enabled: true },
      description: { enabled: false, modelPath: "mobileface.json" },
      iris: { enabled: false },
      emotion: { enabled: false, modelPath: "emotion.json" },
      attention: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    hand: { enabled: false },
    body: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  } as const;

  diagnostics = { ...diagnostics, stage: "checando-backend" };
  callbacks.onDiagnostics(diagnostics);
  diagnostics = addFaceBackendAttempt(diagnostics, {
    backend: "wasm",
    result: "skipped",
    elapsedMs: 0,
    errorName: "WasmAssetsUnavailable",
    errorMessage: "Nenhum arquivo WASM local está disponível em public/.",
  });
  callbacks.onDiagnostics(diagnostics);
  const result = await runFaceBackendFallback(
    ["webgl", "cpu"],
    async (backend) => {
      const human = new HumanLibrary({ ...config, backend });
      callbacks.onProgress(backend === "webgl"
        ? "Carregando modelos com WebGL"
        : "WebGL indisponível; tentando CPU");
      await human.load();
      diagnostics = { ...diagnostics, stage: "aquecendo" };
      callbacks.onDiagnostics(diagnostics);
      callbacks.onProgress("Aquecendo detector e malha");
      await human.warmup();
      return human;
    },
    (attempt) => {
      diagnostics = addFaceBackendAttempt(diagnostics, attempt);
      callbacks.onDiagnostics(diagnostics);
    },
  );
  return { human: result.value, backend: result.backend };
}

export async function loadBrowserHuman(
  callbacks: HumanLoaderCallbacks,
  diagnostics: FaceLoadDiagnostics,
) {
  callbackListeners.add(callbacks);
  callbacks.onDiagnostics(sharedDiagnostics.stage === "idle" ? diagnostics : sharedDiagnostics);
  publishProgress("Iniciando detector local");
  try {
    const result = await humanLoader.load(() => createBrowserHuman(sharedCallbacks(), diagnostics));
    publishDiagnostics({ ...sharedDiagnostics, stage: "pronto" });
    publishProgress("Detector pronto");
    return result;
  } finally {
    callbackListeners.delete(callbacks);
  }
}

function loadOptionalFaceModel(
  human: BrowserHuman,
  model: "descriptor" | "emotion",
  callbacks: HumanLoaderCallbacks,
  diagnostics: FaceLoadDiagnostics,
) {
  const loader = model === "descriptor" ? descriptorLoader : emotionLoader;
  const files = model === "descriptor" ? faceModelFiles.descriptor : faceModelFiles.emotion;
  return loader.load(() => {
    const operation = optionalModelsQueue.catch(() => undefined).then(async () => {
      if (model === "descriptor") {
        human.config.face.description = { ...human.config.face.description, enabled: true };
      } else {
        human.config.face.emotion = { ...human.config.face.emotion, enabled: true };
      }
      diagnostics = { ...diagnostics, stage: "baixando-modelo" };
      callbacks.onDiagnostics(diagnostics);
      callbacks.onProgress(model === "descriptor" ? "Baixando MobileFace" : "Baixando modelo de emoção");
      await verifyLocalModelFiles(files, callbacks, diagnostics);
      await human.load();
      await human.warmup();
      callbacks.onProgress(model === "descriptor" ? "MobileFace pronto" : "Modelo de emoção pronto");
    });
    optionalModelsQueue = operation;
    return operation;
  });
}

export function loadFaceDescriptor(
  human: BrowserHuman,
  callbacks: HumanLoaderCallbacks,
  diagnostics: FaceLoadDiagnostics,
) {
  callbackListeners.add(callbacks);
  const current = sharedDiagnostics.stage === "idle" ? diagnostics : sharedDiagnostics;
  publishDiagnostics(current);
  return loadOptionalFaceModel(human, "descriptor", sharedCallbacks(), current).finally(() => callbackListeners.delete(callbacks));
}

export function loadFaceEmotion(
  human: BrowserHuman,
  callbacks: HumanLoaderCallbacks,
  diagnostics: FaceLoadDiagnostics,
) {
  callbackListeners.add(callbacks);
  const current = sharedDiagnostics.stage === "idle" ? diagnostics : sharedDiagnostics;
  publishDiagnostics(current);
  return loadOptionalFaceModel(human, "emotion", sharedCallbacks(), current).finally(() => callbackListeners.delete(callbacks));
}

export function isValidBrowserEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== faceEmbeddingDimension
    || value.some((component) => typeof component !== "number" || !Number.isFinite(component))) return false;
  const norm = Math.hypot(...value);
  return Number.isFinite(norm) && norm >= 0.95 && norm <= 1.05;
}

export function extractFaceEmbedding(face: BrowserFace) {
  return isValidBrowserEmbedding(face.embedding) ? face.embedding : null;
}
