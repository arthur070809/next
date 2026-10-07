"use client";

import type Human from "@vladmandic/human";
import { faceCaptureQuality, faceEmbeddingDimension } from "./config";

export type BrowserHuman = InstanceType<typeof Human>;
export type BrowserFace = Awaited<ReturnType<BrowserHuman["detect"]>>["face"][number];

function isHumanConstructor(candidate: unknown): candidate is typeof Human {
  return typeof candidate === "function";
}

export async function loadBrowserHuman(onProgress: (message: string) => void) {
  onProgress("Carregando o reconhecedor facial local");
  // The package root resolves to its Node entry during server-side rendering.
  const candidate: unknown = (await import("../../node_modules/@vladmandic/human/dist/human.esm.js")).default;
  if (!isHumanConstructor(candidate)) throw new Error("Local facial model could not be loaded.");
  const HumanLibrary = candidate;
  const config = {
    modelBasePath: "/models/human/",
    cacheModels: true,
    debug: false,
    face: {
      detector: {
        maxDetected: faceCaptureQuality.detectorMaxFaces,
        minConfidence: faceCaptureQuality.detectorMinConfidence,
        rotation: true,
      },
      mesh: { enabled: true },
      description: { enabled: true, modelPath: "mobileface.json" },
      iris: { enabled: true },
      emotion: { enabled: true, modelPath: "emotion.json" },
    },
    hand: { enabled: false },
    body: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  } as const;

  let human = new HumanLibrary({ ...config, backend: "webgl" });
  let backend = "webgl";
  onProgress("Carregando os modelos locais (aprox. 7,6 MiB)");
  try {
    await human.load();
    onProgress("Preparando o reconhecimento facial");
    await human.warmup();
  } catch {
    human = new HumanLibrary({ ...config, backend: "cpu" });
    backend = "cpu (fallback)";
    onProgress("Preparando o reconhecimento facial em modo compatível");
    await human.load();
    await human.warmup();
  }
  return { human, backend };
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
