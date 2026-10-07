"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { faceConsentText } from "@/lib/face-consent";
import { FACE_QUALITY_LIMITS, evaluateFaceQuality, selectDominantFace, shouldFinishFrameCollection } from "@/lib/facial/face-quality";
import { advanceBlinkState, faceEyeAspectRatio, initialBlinkState, type BlinkState } from "@/lib/facial/blink";
import { acquireEnrollmentSubmission, selectBestEnrollmentFrames, type ScoredEnrollmentFrame } from "@/lib/facial/enrollment-capture";
import { measureFaceFrame } from "@/lib/facial/frame-metrics";
import { extractFaceEmbedding, loadBrowserHuman, type BrowserFace, type BrowserHuman } from "@/lib/facial/human-browser";
import { cameraErrorMessage } from "@/lib/qr/camera-utils";
import { createCameraStreamController, type CameraStreamController } from "@/lib/camera/camera-stream";
import BuildIdentifier from "@/app/components/BuildIdentifier";
import styles from "./face-enrollment.module.css";

type Employee = { id: number; nome: string; cracha: string; enrolled: boolean };
type Session = { id: string; token: string; expiraEm: string };
type Stage = "front" | "success" | "failed";
type EnrollmentFrame = { embedding: number[] };
type EnrollmentFrameCandidate = ScoredEnrollmentFrame<EnrollmentFrame>;
type EnrollmentDiagnostics = {
  comparisons?: Array<{ nome: string; cracha: string; relation: "same" | "different"; distance: number }>;
  modelVersion?: string;
};
class EnrollmentResponseError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

type FaceResult = BrowserFace;

function drawMesh(canvas: HTMLCanvasElement, video: HTMLVideoElement, face: FaceResult | null) {
  const context = canvas.getContext("2d"); if (!context) return;
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!face?.mesh?.length) return;
  context.fillStyle = "rgb(255 255 255 / 70%)";
  for (const point of face.mesh) { context.beginPath(); context.arc(point[0] ?? 0, point[1] ?? 0, 1.2, 0, Math.PI * 2); context.fill(); }
}

export default function FaceEnrollmentManager({
  diagnosticsEnabled = false,
  frameCount = 1,
  requireConsent = false,
  requireBlink = false,
}: {
  diagnosticsEnabled?: boolean;
  frameCount?: number;
  requireConsent?: boolean;
  requireBlink?: boolean;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<Stage>("front");
  const [stageReady, setStageReady] = useState(false);
  const [modelState, setModelState] = useState<"loading" | "ready" | "error">("loading");
  const [modelProgress, setModelProgress] = useState("Carregando modelos locais");
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
    qualityPassed: false,
    blinkObserved: false,
    resultCode: "—",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<CameraStreamController | null>(null);
  const detectorCleanupRef = useRef<(() => void) | null>(null);
  const renewalTimerRef = useRef<number | null>(null);
  const humanRef = useRef<BrowserHuman | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const invalidSinceRef = useRef(0);
  const collectionStartedAtRef = useRef(0);
  const burstFramesRef = useRef<EnrollmentFrameCandidate[]>([]);
  const candidateFramesObservedRef = useRef(0);
  const blinkObservedRef = useRef(false);
  const blinkStateRef = useRef<BlinkState>(initialBlinkState);
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
    invalidSinceRef.current = 0;
    collectionStartedAtRef.current = 0;
    burstFramesRef.current = [];
    candidateFramesObservedRef.current = 0;
    blinkObservedRef.current = false;
    blinkStateRef.current = initialBlinkState;
    setStageReady(false);
    setCameraState("idle");
  }

  async function loadModels() {
    try {
      const { human, backend: activeBackend } = await loadBrowserHuman(setModelProgress);
      setBackend(activeBackend);
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
    queueMicrotask(() => setDebug(diagnosticsEnabled));
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
            const restoredEmployee = (data.employees as Employee[] | undefined)?.find(
              (item) => item.id === Number(restored.employeeId),
            );
            if (restoredEmployee?.enrolled) {
              localStorage.removeItem("marcon-face-enrollment-session");
              return;
            }
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
  }, [diagnosticsEnabled]);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { if (session && employeeId) localStorage.setItem("marcon-face-enrollment-session", JSON.stringify({ employeeId, session })); }, [employeeId, session]);

  async function selectEmployee(value: string) {
    const selected = employees.find((item) => item.id === Number(value));
    if (selected?.enrolled && !window.confirm(`O funcionário ${selected.nome} já tem template facial. Deseja substituí-lo?`)) return;
    stopCamera(); setEmployeeId(value); setSession(null); setReplaceConfirmed(Boolean(selected?.enrolled)); localStorage.removeItem("marcon-face-enrollment-session"); setStage("front"); setConsent(false); setError(""); setMessage("");
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

  const submitEnrollment = useCallback(async function submitEnrollmentImpl(nextSamples: number[][]) {
    if (nextSamples.length !== frameCount || !sessionRef.current || !acquireEnrollmentSubmission(submittingRef)) return;
    setBusy(true); setInstruction("Processando e confirmando o cadastro");
    const current = sessionRef.current;
    try {
      const response = await fetch("/api/admin/face-enrollment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token, consent: requireConsent && consent, ...(requireConsent ? { consentAt: new Date().toISOString() } : {}), replaceConfirmed, samples: nextSamples }) });
      const data = await response.json() as { error?: string; code?: string; diagnostics?: EnrollmentDiagnostics };
      if (diagnosticsEnabled) {
        setDebugMetrics((currentMetrics) => ({
          ...currentMetrics,
          resultCode: data.code ?? (response.ok ? "FACE_ENROLLMENT_OK" : "FACE_ENROLLMENT_FAILED"),
        }));
      }
      if (diagnosticsEnabled && data.diagnostics) {
        const comparisons = data.diagnostics.comparisons?.map((item) =>
          `${item.relation === "same" ? "mesma pessoa" : "pessoa diferente"} (${item.cracha}): ${item.distance.toFixed(4)}`,
        ).join("; ") ?? "sem templates compatíveis para comparação";
        setConsistencyDiagnostics(`modelo ${data.diagnostics.modelVersion ?? "—"}; distâncias reais: ${comparisons}`);
      }
      if (response.status === 409 && data.code === "FACE_ENROLLMENT_SESSION_EXPIRED" && await renewSession()) { submittingRef.current = false; setBusy(false); await submitEnrollmentImpl(nextSamples); return; }
      if (response.status === 409 && data.code === "FACE_CAPTURE_RETRY") {
        burstFramesRef.current = [];
        candidateFramesObservedRef.current = 0;
        collectionStartedAtRef.current = 0;
        blinkObservedRef.current = false;
        blinkStateRef.current = initialBlinkState;
        setStageReady(false);
        setInstruction("Mantenha apenas seu rosto diante da câmera; tentando novamente.");
        return;
      }
      if (response.status === 429) { stopCamera(); setError(`${data.error} Tente novamente em ${Math.ceil(Number(response.headers.get("Retry-After") ?? 60) / 60)} minutos.`); setStage("failed"); return; }
      if (!response.ok) throw new EnrollmentResponseError(data.error ?? "Não foi possível concluir o cadastro.", data.code ?? "FACE_ENROLLMENT_FAILED");
      setMessage("Cadastro concluído"); setInstruction("Cadastro concluído"); setStage("success"); localStorage.removeItem("marcon-face-enrollment-session"); stopCamera(); setEmployees((currentEmployees) => currentEmployees.map((item) => item.id === Number(employeeId) ? { ...item, enrolled: true } : item));
    } catch (cause) {
      if (cause instanceof EnrollmentResponseError) setDebugMetrics((currentMetrics) => ({ ...currentMetrics, resultCode: cause.code }));
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro.");
      setInstruction("Tente novamente");
      setStage("failed");
      stopCamera();
    }
    finally { submittingRef.current = false; setBusy(false); }
  }, [consent, diagnosticsEnabled, employeeId, frameCount, renewSession, replaceConfirmed, requireConsent]);

  async function startCamera() {
    if (!employeeId || (requireConsent && !consent) || modelState !== "ready") return;
    setError(""); setCameraState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("missing", "NotFoundError");
      stopCamera();
      invalidSinceRef.current = 0;
      collectionStartedAtRef.current = 0;
      burstFramesRef.current = [];
      candidateFramesObservedRef.current = 0;
      blinkObservedRef.current = false;
      blinkStateRef.current = initialBlinkState;
      const video = videoRef.current;
      const camera = createCameraStreamController({
        video,
        onLifecycleStop: (reason) => {
          if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current);
          renewalTimerRef.current = null;
          streamRef.current = null;
          setCameraState("denied");
          if (reason === "visibilitychange") {
            setError("Câmera pausada ao sair desta tela. Toque para recomeçar.");
            setInstruction("Câmera pausada");
          }
        },
      });
      cameraRef.current = camera;
      streamRef.current = await camera.start({
        video: {
          facingMode: "user",
          width: { ideal: FACE_QUALITY_LIMITS.cameraWidth },
          height: { ideal: FACE_QUALITY_LIMITS.cameraHeight },
        },
        audio: false,
      });
      setCameraState("ready");
      setStageReady(false);
      setStage("front");
      setInstruction("Procurando rosto");
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

  useEffect(() => {
    if (cameraState !== "ready" || modelState !== "ready") return;
    let stopped = false;
    let pending = false;
    let lastRun = 0;
    let frame = 0;
    const detect = async (time: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(detect);
      if (document.hidden) {
        burstFramesRef.current = [];
        candidateFramesObservedRef.current = 0;
        collectionStartedAtRef.current = 0;
        return;
      }
      if (pending || time - lastRun < FACE_QUALITY_LIMITS.analysisIntervalMs || !videoRef.current || !humanRef.current) return;
      if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !videoRef.current.videoWidth) return;
      lastRun = time;
      pending = true;
      try {
        const inferenceStarted = performance.now();
        const result = await humanRef.current.detect(videoRef.current);
        if (stopped) return;
        const inferenceMs = Math.round(performance.now() - inferenceStarted);
        const faces = result.face ?? [];
        const face = selectDominantFace(faces, (candidate) => candidate.boxRaw);
        drawMesh(overlayRef.current!, videoRef.current, face);
        const light = measureFaceFrame(videoRef.current);
        if (!face) {
          burstFramesRef.current = [];
          candidateFramesObservedRef.current = 0;
          collectionStartedAtRef.current = 0;
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          setStageReady(false);
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setInstruction("Aproxime o rosto e procure mais luz.");
          }
          if (debug && time - lastDebugAtRef.current >= 500) {
            lastDebugAtRef.current = time;
            setDebugMetrics((current) => ({
              ...current, inferenceMs, faceCount: faces.length, qualityPassed: false, blinkObserved: false,
            }));
          }
          return;
        }
        const rotation = face.rotation?.angle;
        const eyeMesh = (face.mesh ?? []).map((point) => [point[0] ?? Number.NaN, point[1] ?? Number.NaN]);
        const ear = faceEyeAspectRatio(eyeMesh);
        const quality = evaluateFaceQuality({
          faceCount: 1,
          faceWidthRatio: face.boxRaw[2],
          centerXRatio: face.boxRaw[0] + face.boxRaw[2] / 2,
          centerYRatio: face.boxRaw[1] + face.boxRaw[3] / 2,
          yawDegrees: rotation?.yaw ?? Number.NaN,
          pitchDegrees: rotation?.pitch ?? Number.NaN,
          rollDegrees: rotation?.roll ?? Number.NaN,
          sharpness: light.sharpness,
          detectionConfidence: face.boxScore ?? 0,
          brightness: light.brightness,
        });
        if (debug && time - lastDebugAtRef.current >= 500) {
          lastDebugAtRef.current = time;
          setDebugMetrics((current) => ({
            ...current,
            inferenceMs,
            detectionScore: face.boxScore ?? 0,
            faceWidth: Math.round(face.boxRaw[2] * 100),
            brightness: Math.round(light.brightness),
            sharpness: Math.round(light.sharpness),
            faceCount: faces.length,
            qualityPassed: quality.valid,
            blinkObserved: blinkObservedRef.current,
          }));
        }
        if (!quality.valid) {
          burstFramesRef.current = [];
          candidateFramesObservedRef.current = 0;
          collectionStartedAtRef.current = 0;
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          setStageReady(false);
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setInstruction("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        invalidSinceRef.current = 0;
        const eyesOpen = ear !== null && ear >= FACE_QUALITY_LIMITS.minimumOpenEyeAspectRatio;
        if (requireBlink) {
          if (ear !== null) blinkStateRef.current = advanceBlinkState(blinkStateRef.current, ear, time);
          blinkObservedRef.current = blinkStateRef.current.completedAt !== null;
        }
        if (requireBlink && !blinkObservedRef.current) {
          setInstruction("Procurando rosto; pisque uma vez quando estiver pronto.");
          return;
        }
        if (!eyesOpen) {
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setInstruction("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        const embedding = extractFaceEmbedding(face);
        if (!embedding) {
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setInstruction("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        if (!collectionStartedAtRef.current) collectionStartedAtRef.current = time;
        const score = quality.score;
        burstFramesRef.current = [...burstFramesRef.current, { frame: { embedding }, score }]
          .slice(-FACE_QUALITY_LIMITS.maximumCandidateFrames);
        candidateFramesObservedRef.current = burstFramesRef.current.length;
        setStageReady(true);
        setInstruction("Processando cadastro");
        const scores = burstFramesRef.current.map((candidate) => candidate.score);
        if (shouldFinishFrameCollection({
          scores,
          requestedFrameCount: frameCount,
          elapsedMs: time - collectionStartedAtRef.current,
        }) && !submittingRef.current) {
          const selected = selectBestEnrollmentFrames(burstFramesRef.current, frameCount);
          if (selected.length === frameCount) void submitEnrollment(selected.map((candidate) => candidate.embedding));
        }
      } catch (cause) {
        burstFramesRef.current = [];
        candidateFramesObservedRef.current = 0;
        collectionStartedAtRef.current = 0;
        if (!invalidSinceRef.current) invalidSinceRef.current = time;
        if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
          setInstruction("Aproxime o rosto e procure mais luz.");
        }
        setDebugMetrics((metrics) => ({ ...metrics, resultCode: cause instanceof Error ? cause.name : "INFERENCE_FAILED" }));
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
  }, [cameraState, modelState, employeeId, submitEnrollment, debug, frameCount, requireBlink]);

  useEffect(() => {
    if (cameraState !== "ready") return;
    renewalTimerRef.current = window.setInterval(() => { void renewSession(); }, 60_000);
    return () => {
      if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current);
      renewalTimerRef.current = null;
    };
  }, [cameraState, employeeId, renewSession]);

  const employee = employees.find((item) => item.id === Number(employeeId));
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
        {employee?.enrolled && <p role="status" className={styles.hint}>Este funcionário já tem cadastro facial. A substituição foi confirmada ao selecioná-lo.</p>}
        {modelState === "loading" && <p className={styles.modelStatus}>{modelProgress}</p>}
        {modelState === "error" && <button type="button" onClick={() => void loadModels()}>Tentar carregar modelos</button>}
        <div className={`${styles.scanner} ${stage === "success" ? styles.scannerSuccess : ""}`}>
          <video ref={videoRef} muted playsInline className={styles.video} aria-label="Prévia da câmera para cadastro facial" />
          <canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" />
          <div className={styles.oval} aria-hidden="true" style={{ "--progress": stageReady ? "100%" : "0%" } as CSSProperties} />
          <p className={styles.instruction} aria-live="polite">
            {busy ? "Validando e salvando o template" : cameraState === "starting" ? "Pedindo permissão da câmera" : instruction}
          </p>
          {stage === "success" && <span className={styles.check} aria-label="Cadastro concluído">✓</span>}
        </div>
        {debug && (
          <section aria-label="Diagnóstico facial" className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs text-slate-800 sm:grid-cols-3">
            <p>Modelos: {modelState}</p>
            <p>Backend: {backend}</p>
            <p>Câmera: {cameraState}</p>
            <p>Inferência: {debugMetrics.inferenceMs} ms</p>
            <p>Faces detectadas: {debugMetrics.faceCount}</p>
            <p>Qualidade completa: {debugMetrics.qualityPassed ? "sim" : "não"}</p>
            <p>Piscada observada: {debugMetrics.blinkObserved ? "sim" : "não"}</p>
            <p>Pontuação detecção: {debugMetrics.detectionScore.toFixed(3)}</p>
            <p>Tamanho do rosto: {debugMetrics.faceWidth}% do quadro</p>
            <p>Brilho médio: {debugMetrics.brightness}</p>
            <p>Nitidez: {debugMetrics.sharpness}</p>
            <p className="col-span-2 break-words sm:col-span-3">Resultado/erro: {debugMetrics.resultCode}</p>
            {consistencyDiagnostics && <p className="col-span-2 break-words sm:col-span-3">{consistencyDiagnostics}</p>}
          </section>
        )}
        {requireConsent && <label className={styles.consent}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>{faceConsentText}</span>
        </label>}
        {requireBlink
          ? <p className={styles.hint}>A piscada será verificada antes do cadastro.</p>
          : <p className={styles.hint}>Aviso de teste: sem piscada, uma foto ou vídeo pode passar pela verificação no aparelho; nonce, limite de tentativas e limiar do servidor continuam ativos.</p>}
        <div className={styles.actions}>
          {cameraState === "ready"
            ? <button type="button" disabled={busy} onClick={stopCamera}>Cancelar</button>
            : <button type="button" className={styles.primary} disabled={!employee || !session || (requireConsent && !consent) || modelState !== "ready" || cameraState === "starting" || busy} onClick={() => void startCamera()}>
                {cameraState === "starting" ? "Iniciando câmera..." : stage === "failed" || cameraState === "denied" || cameraState === "missing" ? "Tentar novamente" : "Iniciar cadastro"}
              </button>}
        </div>
        <p className={styles.hint}>
          Posicione o rosto de frente e com luz suficiente. O melhor quadro será enviado e salvo automaticamente; nenhuma foto é armazenada.
        </p>
      </section>
    </main>
  );
}
