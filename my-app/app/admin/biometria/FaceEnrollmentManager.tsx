"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { faceConsentText } from "@/lib/face-consent";
import { faceCaptureQuality } from "@/lib/facial/config";
import { canUseFaceGallery, getNextEnrollmentStage, type EnrollmentStage } from "@/lib/facial/enrollment-flow";
import { inspectFaceCount } from "@/lib/facial/face-count";
import { encodeFacePhoto, normalizeFacePhoto, validateFacePhoto } from "@/lib/facial/photo";
import { cameraErrorMessage } from "@/lib/qr/camera-utils";
import { createCameraStreamController, type CameraStreamController } from "@/lib/camera/camera-stream";
import BuildIdentifier from "@/app/components/BuildIdentifier";
import styles from "./face-enrollment.module.css";

type Employee = { id: number; nome: string; cracha: string; enrolled: boolean };
type Session = { id: string; token: string; expiraEm: string };
type Stage = "front" | "left" | "right" | "blink" | "success" | "failed";
type EnrollmentDiagnostics = { source?: string; threshold?: number; distances?: number[]; discardedOutlier?: boolean; descriptorError?: string };
class EnrollmentResponseError extends Error {
  constructor(message: string, readonly code: string, readonly diagnostics?: EnrollmentDiagnostics) {
    super(message);
  }
}

type FaceResult = { mesh?: Array<Array<number | undefined>>; boxRaw: [number, number, number, number]; score?: number; boxScore?: number; annotations?: Record<string, Array<Array<number | undefined>>>; rotation?: { angle: { roll: number; yaw: number; pitch: number } } | null };
type HumanDetector = { detect(input: HTMLVideoElement | HTMLImageElement): Promise<{ face?: FaceResult[] }> };
function isCaptureStage(stage: Stage): stage is EnrollmentStage {
  return stage === "front" || stage === "left" || stage === "right" || stage === "blink";
}

function createStageOrder(): EnrollmentStage[] {
  return ["front", ...(Math.random() > 0.5 ? ["left", "right"] as EnrollmentStage[] : ["right", "left"] as EnrollmentStage[]), "blink"];
}

function eyesAreOpen(face: FaceResult) {
  const left = face.annotations?.leftEye ?? [];
  const right = face.annotations?.rightEye ?? [];
  const ratio = (eye: Array<Array<number | undefined>>) => {
    if (eye.length < 4) return 1;
    const xs = eye.map((point) => point[0] ?? 0); const ys = eye.map((point) => point[1] ?? 0);
    return (Math.max(...ys) - Math.min(...ys)) / Math.max(1, Math.max(...xs) - Math.min(...xs));
  };
  return ratio(left) > faceCaptureQuality.eyeAspectRatioMin && ratio(right) > faceCaptureQuality.eyeAspectRatioMin;
}

function inspectLight(video: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = faceCaptureQuality.lightSampleWidth;
  canvas.height = faceCaptureQuality.lightSampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { brightness: 0, sharpness: 0 };
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0; let edge = 0; let previous = 0;
  for (let index = 0; index < data.length; index += 4) {
    const value = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    sum += value; if (index) edge += Math.abs(value - previous); previous = value;
  }
  return { brightness: sum / (data.length / 4), sharpness: edge / (data.length / 4) };
}

function drawMesh(canvas: HTMLCanvasElement, video: HTMLVideoElement, face: FaceResult | null) {
  const context = canvas.getContext("2d"); if (!context) return;
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!face?.mesh?.length) return;
  context.fillStyle = "rgb(255 255 255 / 70%)";
  for (const point of face.mesh) { context.beginPath(); context.arc(point[0] ?? 0, point[1] ?? 0, 1.2, 0, Math.PI * 2); context.fill(); }
}

export default function FaceEnrollmentManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [consent, setConsent] = useState(false);
  const [confirmedPerson, setConfirmedPerson] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>("front");
  const [stageReady, setStageReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "gallery">("camera");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [modelState, setModelState] = useState<"loading" | "ready" | "error">("loading");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "ready" | "denied" | "missing">("idle");
  const [instruction, setInstruction] = useState("Carregando modelos de visão");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [backend, setBackend] = useState("—");
  const [consistencyDiagnostics, setConsistencyDiagnostics] = useState("");
  const [debugMetrics, setDebugMetrics] = useState({
    inferenceMs: 0,
    detectionScore: 0,
    faceWidth: 0,
    brightness: 0,
    sharpness: 0,
    faceCount: 0,
    resultCode: "—",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<CameraStreamController | null>(null);
  const detectorCleanupRef = useRef<(() => void) | null>(null);
  const renewalTimerRef = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const humanRef = useRef<HumanDetector | null>(null);
  const stageRef = useRef<Stage>("front");
  const stageOrderRef = useRef<EnrollmentStage[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const samplesRef = useRef<string[]>([]);
  const stableSinceRef = useRef(0);
  const submittingRef = useRef(false);
  const lastDebugAtRef = useRef(0);

  function stopCamera() {
    detectorCleanupRef.current?.();
    detectorCleanupRef.current = null;
    if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current);
    renewalTimerRef.current = null;
    const camera = cameraRef.current;
    cameraRef.current = null;
    streamRef.current = null;
    if (camera) camera.dispose();
    else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    setStageReady(false);
    setCameraState("idle");
  }

  async function loadModels() {
    try {
      const loadBrowserModule = new Function("url", "return import(url)") as (url: string) => Promise<{ default: new (config: Record<string, unknown>) => HumanDetector & { load(): Promise<void>; warmup(): Promise<void> } }>;
      const { default: Human } = await loadBrowserModule("https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.esm.js");
      const modelBasePath = "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";
      const config = { modelBasePath, cacheModels: true, debug: false, face: { detector: { maxDetected: faceCaptureQuality.detectorMaxFaces, minConfidence: faceCaptureQuality.detectorMinConfidence, rotation: true }, mesh: { enabled: true }, description: { enabled: true }, iris: { enabled: true } } };
      let human = new Human({ ...config, backend: "webgl" });
      try {
        await human.load();
        await human.warmup();
        setBackend("webgl");
      } catch {
        human = new Human({ ...config, backend: "cpu" });
        await human.load();
        await human.warmup();
        setBackend("cpu (fallback)");
      }
      humanRef.current = human;
      setModelState("ready");
      setInstruction("Selecione o funcionário e confirme a pessoa diante da câmera");
    } catch (cause) {
      setModelState("error");
      setInstruction("Modelo facial indisponível. Verifique a rede e tente novamente.");
      setDebugMetrics((current) => ({ ...current, resultCode: cause instanceof Error ? cause.name : "MODEL_LOAD_FAILED" }));
    }
  }

  useEffect(() => {
    queueMicrotask(() => setDebug(new URLSearchParams(window.location.search).get("debug") === "1"));
    const timer = window.setTimeout(() => {
      void loadModels();
      void fetch("/api/admin/face-enrollment").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os funcionários.");
        setEmployees(data.employees ?? []);
        const saved = localStorage.getItem("marcon-face-enrollment-session");
        if (saved) {
          try {
            const restored = JSON.parse(saved) as { employeeId: string; session: Session };
            const renewed = await fetch("/api/admin/face-enrollment", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ funcionarioId: Number(restored.employeeId), sessionId: restored.session.id, sessionToken: restored.session.token }),
            });
            if (renewed.ok) {
              const renewal = await renewed.json();
              const nextSession = { ...restored.session, expiraEm: renewal.expiraEm };
              sessionRef.current = nextSession;
              setEmployeeId(restored.employeeId);
              setSession(nextSession);
            } else {
              localStorage.removeItem("marcon-face-enrollment-session");
            }
          } catch {
            localStorage.removeItem("marcon-face-enrollment-session");
          }
        }
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os funcionários."));
    }, 0);
    return () => { window.clearTimeout(timer); stopCamera(); };
  }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { if (session && employeeId) localStorage.setItem("marcon-face-enrollment-session", JSON.stringify({ employeeId, session })); }, [employeeId, session]);
  useEffect(() => { samplesRef.current = samples; }, [samples]);

  async function selectEmployee(value: string) {
    stopCamera(); setEmployeeId(value); setSession(null); localStorage.removeItem("marcon-face-enrollment-session"); setSamples([]); samplesRef.current = []; stageOrderRef.current = []; stageRef.current = "front"; setStage("front"); setPhotoPreview(null); setConfirmedPerson(false); setConsent(false); setError(""); setMessage("");
    if (!value) return;
    const response = await fetch(`/api/admin/face-enrollment?funcionarioId=${encodeURIComponent(value)}`); const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Não foi possível iniciar a sessão."); return; }
    const nextSession = data.session as Session;
    sessionRef.current = nextSession;
    setSession(nextSession);
  }

  const renewSession = useCallback(async () => {
    const current = sessionRef.current; if (!current || !employeeId) return false;
    const response = await fetch("/api/admin/face-enrollment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token }) });
    if (!response.ok) return false; const data = await response.json(); const nextSession = { ...current, expiraEm: data.expiraEm }; sessionRef.current = nextSession; setSession(nextSession); return true;
  }, [employeeId]);

  const submitEnrollment = useCallback(async function submitEnrollmentImpl(nextSamples: string[]) {
    if (submittingRef.current || nextSamples.length < 3 || !sessionRef.current) return;
    submittingRef.current = true; setBusy(true); setInstruction("Processando e confirmando o cadastro");
    const current = sessionRef.current;
    try {
      const response = await fetch("/api/admin/face-enrollment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token, consent: true, consentAt: new Date().toISOString(), samples: nextSamples }) });
      const data = await response.json() as { error?: string; code?: string; consistency?: EnrollmentDiagnostics };
      if (data.consistency) {
        setConsistencyDiagnostics(`${data.consistency.source ?? "origem não informada"}; limiar: ${data.consistency.threshold ?? "—"}; distâncias: ${data.consistency.distances?.join(", ") ?? "—"}; outlier descartado: ${data.consistency.discardedOutlier ? "sim" : "não"}${data.consistency.descriptorError ? `; descritor: ${data.consistency.descriptorError}` : ""}`);
        setDebugMetrics((currentMetrics) => ({
          ...currentMetrics,
          resultCode: data.code ?? (response.ok ? "FACE_ENROLLMENT_OK" : "FACE_ENROLLMENT_FAILED"),
        }));
      }
      if (response.status === 409 && data.code === "FACE_ENROLLMENT_SESSION_EXPIRED" && await renewSession()) { submittingRef.current = false; setBusy(false); await submitEnrollmentImpl(nextSamples); return; }
      if (response.status === 429) { setError(`${data.error} Tente novamente em ${Math.ceil(Number(response.headers.get("Retry-After") ?? 60) / 60)} minutos.`); setStage("failed"); return; }
      if (!response.ok) throw new EnrollmentResponseError(data.error ?? "Não foi possível concluir o cadastro.", data.code ?? "FACE_ENROLLMENT_FAILED", data.consistency);
      setMessage("Cadastro concluído"); setInstruction("Cadastro concluído"); setStage("success"); localStorage.removeItem("marcon-face-enrollment-session"); stopCamera(); setEmployees((currentEmployees) => currentEmployees.map((item) => item.id === Number(employeeId) ? { ...item, enrolled: true } : item));
    } catch (cause) {
      if (cause instanceof EnrollmentResponseError) setDebugMetrics((currentMetrics) => ({ ...currentMetrics, resultCode: cause.code }));
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro.");
      setInstruction("Tente novamente");
      setStage("failed");
    }
    finally { submittingRef.current = false; setBusy(false); }
  }, [employeeId, renewSession]);

  async function startCamera() {
    if (!confirmedPerson || !consent || modelState !== "ready") return;
    if (!stageOrderRef.current.length) stageOrderRef.current = createStageOrder();
    setError(""); setCameraState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("missing", "NotFoundError");
      stopCamera();
      const video = videoRef.current;
      const camera = createCameraStreamController({
        video,
        onLifecycleStop: () => {
          if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current);
          renewalTimerRef.current = null;
          streamRef.current = null;
          setCameraState("idle");
        },
      });
      cameraRef.current = camera;
      streamRef.current = await camera.start({
        video: {
          facingMode: "user",
          width: { ideal: faceCaptureQuality.cameraWidth },
          height: { ideal: faceCaptureQuality.cameraHeight },
        },
        audio: false,
      });
      setCameraState("ready");
      setStageReady(false);
      setInstruction(stageRef.current === "front" ? "Posicione o rosto na oval" : "Posicione o rosto para a próxima captura");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      cameraRef.current?.dispose();
      cameraRef.current = null;
      streamRef.current = null;
      const name = cause instanceof DOMException ? cause.name : "";
      setCameraState(name === "NotFoundError" ? "missing" : "denied");
      setError(cameraErrorMessage(cause));
      setDebugMetrics((metrics) => ({ ...metrics, resultCode: name || "CAMERA_START_FAILED" }));
    }
  }

  function captureFrame() {
    const video = videoRef.current; if (!video) return null;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null;
    return encodeFacePhoto(video, video.videoWidth, video.videoHeight);
  }

  function captureCurrentPhoto() {
    if (!stageReady || photoBusy) return;
    let image: string | null;
    try {
      image = captureFrame();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar a captura.");
      return;
    }
    if (!image) {
      setError("A câmera ainda não está pronta para capturar.");
      return;
    }
    setPhotoSource("camera");
    setPhotoPreview(image);
    setError("");
    setInstruction("Confira a captura antes de usá-la");
    stopCamera();
  }

  function retakePhoto() {
    setPhotoPreview(null);
    setError("");
    if (photoSource === "camera") void startCamera();
    else photoInputRef.current?.click();
  }

  function restartCaptureFlow() {
    stopCamera();
    samplesRef.current = [];
    setSamples([]);
    stageOrderRef.current = [];
    stageRef.current = "front";
    setStage("front");
    setPhotoPreview(null);
    setError("");
    setMessage("");
    setInstruction("Posicione o rosto na oval");
  }

  async function handleGalleryPhoto(file: Blob) {
    const validationError = validateFacePhoto(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const image = await normalizeFacePhoto(file);
      setPhotoSource("gallery");
      setPhotoPreview(image);
      setError("");
      stopCamera();
      setInstruction("Confira a foto frontal antes de usá-la");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a imagem.");
    }
  }

  async function acceptPhotoPreview() {
    if (!photoPreview || photoBusy || !humanRef.current) return;
    if (!isCaptureStage(stageRef.current)) return;
    if (photoSource === "gallery" && !canUseFaceGallery(stageRef.current, samplesRef.current.length)) {
      setError("A galeria só pode fornecer a primeira foto frontal. As demais etapas exigem captura ao vivo.");
      return;
    }
    setPhotoBusy(true);
    setError("");
    try {
      const image = new Image();
      image.src = photoPreview;
      let result: { face?: FaceResult[] };
      try {
        await image.decode();
        result = await humanRef.current.detect(image);
      } catch {
        throw new Error("Não foi possível analisar esta imagem. Escolha outra foto ou capture novamente.");
      }
      const faces = result.face ?? [];
      const faceCheck = inspectFaceCount(faces);
      const face = faceCheck.face;
      if (!face) throw new Error(faceCheck.message ?? "Nenhum rosto detectado.");
      const box = face.boxRaw;
      const centerX = box[0] + box[2] / 2;
      const centerY = box[1] + box[3] / 2;
      const centered = centerX > faceCaptureQuality.centerXMin && centerX < faceCaptureQuality.centerXMax
        && centerY > faceCaptureQuality.centerYMin && centerY < faceCaptureQuality.centerYMax;
      const sizeValid = box[2] > faceCaptureQuality.faceWidthMin && box[2] < faceCaptureQuality.faceWidthMax;
      const rotation = face.rotation?.angle;
      const frontFacing = !rotation
        || (Math.abs(rotation.yaw) <= faceCaptureQuality.yawLimitDegrees
          && Math.abs(rotation.pitch) <= faceCaptureQuality.pitchLimitDegrees
          && Math.abs(rotation.roll) <= faceCaptureQuality.rollLimitDegrees);
      const light = inspectLight(image);
      if (!centered) throw new Error("Posicione o rosto no centro da oval.");
      if (!sizeValid) throw new Error("Aproxime ou afaste o rosto para enquadrá-lo.");
      if (!frontFacing) throw new Error("Olhe para a câmera para esta captura.");
      if (light.brightness < faceCaptureQuality.brightnessMin || light.brightness > faceCaptureQuality.brightnessMax) {
        throw new Error("A iluminação da foto está fora do intervalo permitido.");
      }
      if (light.sharpness < faceCaptureQuality.sharpnessMin) throw new Error("A imagem está sem nitidez suficiente.");
      if (face.boxScore !== undefined && face.boxScore < faceCaptureQuality.detectorMinConfidence) {
        throw new Error("A detecção facial ficou abaixo do mínimo.");
      }

      const currentStage = stageRef.current;
      const yaw = rotation?.yaw ?? 0;
      const stagePassed = currentStage === "front"
        || (currentStage === "left" && yaw < -faceCaptureQuality.sideYawDegrees)
        || (currentStage === "right" && yaw > faceCaptureQuality.sideYawDegrees)
        || (currentStage === "blink" && !eyesAreOpen(face));
      if (!stagePassed) {
        throw new Error(currentStage === "blink"
          ? "A captura precisa mostrar o desafio de piscar feito ao vivo."
          : "Vire levemente o rosto na direção indicada.");
      }

      const next = [...samplesRef.current, photoPreview];
      samplesRef.current = next;
      setSamples(next);
      setPhotoPreview(null);
      setStageReady(false);
      if (!stageOrderRef.current.length) stageOrderRef.current = createStageOrder();
      const nextStage = getNextEnrollmentStage(stageOrderRef.current, currentStage);
      stageRef.current = nextStage;
      setStage(nextStage);
      if (nextStage === "success") await submitEnrollment(next);
      else setInstruction(nextStage === "blink"
        ? "Inicie a câmera e pisque antes de capturar"
        : `Inicie a câmera e vire levemente para a ${nextStage === "left" ? "esquerda" : "direita"}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível validar a imagem.");
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    if (cameraState !== "ready" || modelState !== "ready") return;
    let stopped = false;
    let pending = false;
    let lastRun = 0;
    let frame = 0;
    const detect = async (time: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(detect);
      if (document.hidden || pending || time - lastRun < 100 || !videoRef.current || !humanRef.current) return;
      if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !videoRef.current.videoWidth) return;
      lastRun = time;
      pending = true;
      try {
        const inferenceStarted = performance.now();
        const result = await humanRef.current.detect(videoRef.current);
        if (stopped) return;
        const inferenceMs = Math.round(performance.now() - inferenceStarted);
        const faces = result.face ?? [];
        const faceCheck = inspectFaceCount(faces);
        const face = faceCheck.face;
        drawMesh(overlayRef.current!, videoRef.current, face);
        const light = inspectLight(videoRef.current);
        if (debug && time - lastDebugAtRef.current >= 500) {
          lastDebugAtRef.current = time;
          setDebugMetrics((current) => ({
            ...current,
            inferenceMs,
            detectionScore: face?.boxScore ?? 0,
            faceWidth: face ? Math.round(face.boxRaw[2] * 100) : 0,
            brightness: Math.round(light.brightness),
            sharpness: Math.round(light.sharpness),
            faceCount: faces.length,
          }));
        }
        if (!face) {
          stableSinceRef.current = 0;
          setStageReady(false);
          setInstruction(faceCheck.message ?? "Nenhum rosto detectado. Posicione o rosto na oval");
          return;
        }
        const box = face.boxRaw;
        const centerX = box[0] + box[2] / 2;
        const centerY = box[1] + box[3] / 2;
        const center = centerX > faceCaptureQuality.centerXMin
          && centerX < faceCaptureQuality.centerXMax
          && centerY > faceCaptureQuality.centerYMin
          && centerY < faceCaptureQuality.centerYMax;
        const size = box[2] > faceCaptureQuality.faceWidthMin && box[2] < faceCaptureQuality.faceWidthMax;
        const rotation = face.rotation?.angle;
        const front = rotation
          ? Math.abs(rotation.yaw) <= faceCaptureQuality.yawLimitDegrees
            && Math.abs(rotation.pitch) <= faceCaptureQuality.pitchLimitDegrees
            && Math.abs(rotation.roll) <= faceCaptureQuality.rollLimitDegrees
          : true;
        const eyesOpen = eyesAreOpen(face);
        const ready = center && size && front
          && light.brightness >= faceCaptureQuality.brightnessMin
          && light.brightness <= faceCaptureQuality.brightnessMax
          && light.sharpness >= faceCaptureQuality.sharpnessMin
          && (face.boxScore === undefined || face.boxScore >= faceCaptureQuality.detectorMinConfidence);
        if (!ready) {
          stableSinceRef.current = 0;
          setStageReady(false);
          setInstruction(!center
            ? "Posicione o rosto na oval"
            : !size
              ? (box[2] < faceCaptureQuality.faceWidthMin ? "Rosto muito pequeno ou afastado: aproxime-se" : "Afaste-se um pouco")
              : !front
                ? "Olhe para a câmera"
                : light.brightness < faceCaptureQuality.brightnessMin
                  ? "Pouca luz: procure um local mais iluminado"
                  : light.brightness > faceCaptureQuality.brightnessMax
                    ? "Imagem muito clara: evite a luz direta"
                    : light.sharpness < faceCaptureQuality.sharpnessMin
                      ? "Imagem sem nitidez: mantenha o aparelho firme"
                      : "Detecção facial abaixo do mínimo");
          return;
        }
        const currentStage = stageRef.current;
        const yaw = face.rotation?.angle.yaw ?? 0;
        const stagePassed = currentStage === "front"
          || (currentStage === "left" && yaw < -faceCaptureQuality.sideYawDegrees)
          || (currentStage === "right" && yaw > faceCaptureQuality.sideYawDegrees)
          || (currentStage === "blink" && !eyesOpen);
        setInstruction(currentStage === "front" ? "Fique parado" : currentStage === "blink" ? "Pisque" : currentStage === "left" ? "Vire levemente para a esquerda" : "Vire levemente para a direita");
        if (!stagePassed) {
          stableSinceRef.current = 0;
          setStageReady(false);
          return;
        }
        if (!stableSinceRef.current) stableSinceRef.current = time;
        if (time - stableSinceRef.current >= faceCaptureQuality.stableCaptureMs) {
          setStageReady(true);
          setInstruction("Pronto para capturar. Confira a posição e toque em Capturar foto.");
        }
      } catch {
        setInstruction("Não foi possível processar o quadro. Tente novamente");
        setDebugMetrics((metrics) => ({ ...metrics, resultCode: "INFERENCE_FAILED" }));
      } finally {
        pending = false;
      }
    };
    const stopDetection = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      if (detectorCleanupRef.current === stopDetection) detectorCleanupRef.current = null;
    };
    detectorCleanupRef.current = stopDetection;
    const unregisterCleanup = cameraRef.current?.registerCleanup(stopDetection);
    frame = requestAnimationFrame(detect);
    return () => {
      stopDetection();
      unregisterCleanup?.();
    };
  }, [cameraState, modelState, employeeId, submitEnrollment, debug]);

  useEffect(() => {
    if (cameraState !== "ready") return;
    renewalTimerRef.current = window.setInterval(() => { void renewSession(); }, 60_000);
    return () => {
      if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current);
      renewalTimerRef.current = null;
    };
  }, [cameraState, employeeId, renewSession]);

  const employee = employees.find((item) => item.id === Number(employeeId)); const progress = Math.min(100, samples.length * 25);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Administração</p>
        <h1>Cadastro facial presencial</h1>
        <p>Imagens processadas em memória. Apenas o template matemático cifrado é mantido.</p>
        <BuildIdentifier />
      </header>
      {(error || message) && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.success}>{error || message}</p>}
      <section className={styles.panel} aria-busy={busy}>
        <label className={styles.field}>
          Funcionário
          <select value={employeeId} disabled={cameraState === "ready" || busy} onChange={(event) => void selectEmployee(event.target.value)}>
            <option value="">Selecione</option>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.cracha}{item.enrolled ? " · rosto cadastrado" : " · pendente"}</option>)}
          </select>
        </label>
        {employee && <p className={styles.target}><strong>{employee.nome}</strong> · crachá {employee.cracha}</p>}
        {modelState === "loading" && <p className={styles.modelStatus}>Carregando modelos de visão...</p>}
        {modelState === "error" && <button type="button" onClick={() => void loadModels()}>Tentar carregar modelos</button>}
        <div className={`${styles.scanner} ${stage === "success" ? styles.scannerSuccess : ""}`}>
          {photoPreview
            ? <NextImage src={photoPreview} width={1280} height={960} unoptimized className={styles.video} alt="Prévia da foto facial antes da validação" />
            : <video ref={videoRef} muted playsInline className={styles.video} aria-label="Prévia da câmera para cadastro facial" />}
          {!photoPreview && <canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" />}
          <div className={styles.oval} aria-hidden="true" style={{ "--progress": `${progress}%` } as CSSProperties} />
          <p className={styles.instruction} aria-live="polite">
            {photoBusy ? "Validando a captura" : cameraState === "starting" ? "Pedindo permissão da câmera" : instruction}
          </p>
          {stage === "success" && <span className={styles.check} aria-label="Cadastro concluído">✓</span>}
        </div>
        {photoPreview && (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={photoBusy || busy} onClick={() => void acceptPhotoPreview()}>
              {photoBusy ? "Validando…" : "Usar esta foto"}
            </button>
            <button type="button" disabled={photoBusy || busy} onClick={retakePhoto}>
              {photoSource === "camera" ? "Tirar outra" : "Escolher outra"}
            </button>
          </div>
        )}
        {stage === "failed" && samples.length >= 3 && (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void submitEnrollment(samplesRef.current)}>
              Tentar enviar novamente
            </button>
            <button type="button" disabled={busy} onClick={restartCaptureFlow}>Refazer capturas</button>
          </div>
        )}
        {debug && (
          <section aria-label="Diagnóstico facial" className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs text-slate-800 sm:grid-cols-3">
            <p>Modelos: {modelState}</p>
            <p>Backend: {backend}</p>
            <p>Câmera: {cameraState}</p>
            <p>Inferência: {debugMetrics.inferenceMs} ms</p>
            <p>Faces detectadas: {debugMetrics.faceCount}</p>
            <p>Pontuação detecção: {debugMetrics.detectionScore.toFixed(3)}</p>
            <p>Tamanho do rosto: {debugMetrics.faceWidth}% do quadro</p>
            <p>Brilho médio: {debugMetrics.brightness}</p>
            <p>Nitidez: {debugMetrics.sharpness}</p>
            <p className="col-span-2 break-words sm:col-span-3">Resultado/erro: {debugMetrics.resultCode}</p>
            {consistencyDiagnostics && <p className="col-span-2 break-words sm:col-span-3">{consistencyDiagnostics}</p>}
          </section>
        )}
        <label className={styles.consent}>
          <input type="checkbox" checked={confirmedPerson} onChange={(event) => setConfirmedPerson(event.target.checked)} />
          <span>Confirmo que a pessoa diante da câmera é {employee?.nome ?? "o funcionário selecionado"} ({employee?.cracha ?? "crachá"}).</span>
        </label>
        <label className={styles.consent}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>{faceConsentText}</span>
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={!employee || !confirmedPerson || !consent || modelState !== "ready" || cameraState === "starting" || Boolean(photoPreview) || busy || photoBusy || !isCaptureStage(stage)} onClick={() => void startCamera()}>
            {cameraState === "ready" ? "Reiniciar câmera" : samples.length ? "Iniciar câmera para o próximo movimento" : "Iniciar captura"}
          </button>
          {cameraState === "ready" && <button type="button" className={styles.primary} disabled={!stageReady || photoBusy} onClick={captureCurrentPhoto}>Capturar foto</button>}
          {isCaptureStage(stage) && canUseFaceGallery(stage, samples.length) && !photoPreview && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Escolher foto frontal da galeria"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void handleGalleryPhoto(file);
                }}
              />
              <button type="button" disabled={!employee || !confirmedPerson || !consent || modelState !== "ready"} onClick={() => photoInputRef.current?.click()}>
                Escolher foto frontal
              </button>
            </>
          )}
          <button type="button" onClick={stopCamera}>Cancelar câmera</button>
        </div>
        <p className={styles.hint}>
          Cada imagem é validada localmente. A galeria só pode ser usada na etapa frontal; as etapas de movimento e piscada exigem novas capturas ao vivo para preservar a prova de vida.
        </p>
      </section>
    </main>
  );
}
