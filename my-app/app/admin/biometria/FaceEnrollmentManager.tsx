"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { faceConsentText } from "@/lib/face-consent";
import { advanceFaceStability, faceStabilityRequiredMs, type FaceStabilityState } from "@/lib/face-stability";
import styles from "./face-enrollment.module.css";

type Employee = { id: number; nome: string; cracha: string; enrolled: boolean };
type Session = { id: string; token: string; expiraEm: string };
type FaceResult = { mesh?: Array<Array<number | undefined>>; boxRaw?: [number, number, number, number]; rotation?: { angle?: { yaw?: number; pitch?: number; roll?: number } } | null; annotations?: Record<string, Array<Array<number | undefined>>> };
type HumanDetector = { detect(input: HTMLVideoElement): Promise<{ face?: FaceResult[] }> };
type DebugCheck = { name: string; value: string; threshold: string; pass: boolean };
type DebugSnapshot = { checks: DebugCheck[]; stabilityMs: number; requiredMs: number; stage: string; model: string; session: string; service: string; firstFail: string };

const REQUIRED_SAMPLES = 3;
const DEBUG_REQUIRED_STABLE_MS = faceStabilityRequiredMs;
const DEBUG_BRIGHTNESS_MIN = 24;
const DEBUG_CONTRAST_MIN = 6;
const DEBUG_SHARPNESS_MIN = 4;
const DEBUG_MOVEMENT_MAX_RATIO = 0.08;
const DEBUG_MOVEMENT_EMA_ALPHA = 0.25;
const DEBUG_CAPTURE_TIMEOUT_MS = 20_000;

export default function FaceEnrollmentManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [confirmedPerson, setConfirmedPerson] = useState(false);
  const [consent, setConsent] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "ready">("idle");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [modelState, setModelState] = useState<"loading" | "ready" | "error">("loading");
  const [instruction, setInstruction] = useState("Selecione o funcionário e confirme a pessoa diante da câmera");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanDetector | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const samplesRef = useRef<string[]>([]);
  const stabilityRef = useRef<FaceStabilityState>({ accumulatedMs: 0, lastAt: 0, badSince: 0 });
  const movementEmaRef = useRef(0);
  const captureStartedAtRef = useRef(0);
  const previousBoxRef = useRef<[number, number, number, number] | null>(null);
  const lastDebugAtRef = useRef(0);
  const submittingRef = useRef(false);
  const faceReadyRef = useRef(false);
  const cameraStartInFlightRef = useRef(false);
  const lastFaceDetectedRef = useRef(false);
  const openedAtRef = useRef(performance.now());

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
    setCameraDevices([]);
  }

  async function loadModels() {
    try {
      const loadBrowserModule = new Function("url", "return import(url)") as (url: string) => Promise<{ default: new (config: Record<string, unknown>) => HumanDetector & { load(): Promise<void>; warmup(): Promise<void> } }>;
      const { default: Human } = await loadBrowserModule("https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.esm.js");
      const human = new Human({ backend: "webgl", modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/", cacheModels: true, debug: false, face: { detector: { maxDetected: 2, rotation: true }, mesh: { enabled: true }, iris: { enabled: true } } });
      await human.load();
      await human.warmup();
      humanRef.current = human;
      setModelState("ready");
    } catch (cause) {
      const errorId = crypto.randomUUID();
      console.error("Falha ao carregar modelos faciais", { errorId, errorName: cause instanceof Error ? cause.name : "UnknownError" });
      setModelState("error");
      setError(`Modelos faciais indisponíveis (id ${errorId}). A câmera continua disponível, mas a captura fica bloqueada.`);
    }
  }

  async function createEnrollmentSession(value: string) {
    try {
      const response = await fetch(`/api/admin/face-enrollment?funcionarioId=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Sessão indisponível. A câmera continua disponível."); return; }
      setSession(data.session);
      sessionRef.current = data.session;
    } catch (cause) {
      const errorId = crypto.randomUUID();
      console.error("Falha ao criar sessão facial", { errorId, errorName: cause instanceof Error ? cause.name : "UnknownError" });
      setError(`Sessão indisponível (id ${errorId}). A câmera continua disponível.`);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModels();
      void fetch("/api/admin/face-enrollment").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os funcionários.");
        setEmployees(data.employees ?? []);
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os funcionários."));
    }, 0);
    return () => { window.clearTimeout(timer); stopCamera(); };
  }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { samplesRef.current = samples; }, [samples]);
  useEffect(() => {
    if (!session || !employeeId) return;
    localStorage.setItem("marcon-face-enrollment-session", JSON.stringify({ employeeId, session }));
  }, [employeeId, session]);

  function selectEmployee(value: string) {
    stopCamera();
    setEmployeeId(value); setSession(null); sessionRef.current = null;
    setSamples([]); samplesRef.current = []; setConfirmedPerson(false); setConsent(false); setError(""); setMessage("");
    if (value) void createEnrollmentSession(value);
  }

  async function startCamera() {
    if (!employeeId || !confirmedPerson || !consent) return;
    if (cameraStartInFlightRef.current || cameraState === "ready") return;
    cameraStartInFlightRef.current = true;
    setError(""); setCameraState("starting"); setInstruction("Ativando câmera...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("missing", "NotFoundError");
      stopCamera();
      const preferred = { video: { ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : { facingMode: "user" }), width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferred);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "OverconstrainedError") stream = await navigator.mediaDevices.getUserMedia({ video: true });
        else throw cause;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element is unavailable");
      video.srcObject = stream; video.autoplay = true; video.muted = true; video.playsInline = true;
      await video.play();
      setCameraDevices((await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput"));
      captureStartedAtRef.current = performance.now(); stabilityRef.current = { accumulatedMs: 0, lastAt: 0, badSince: 0 }; movementEmaRef.current = 0; previousBoxRef.current = null;
      setCameraState("ready"); setInstruction("Câmera ativa");
      if (!sessionRef.current) void createEnrollmentSession(employeeId);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      const errorId = crypto.randomUUID();
      console.error("Falha ao ativar câmera", { errorId, errorName: name || "UnknownError" });
      setCameraState("idle");
      setError(name === "NotAllowedError" ? "Permissão da câmera negada. Clique no ícone de câmera na barra de endereço e escolha Permitir." : name === "NotFoundError" ? "Nenhuma câmera encontrada." : name === "NotReadableError" ? "A câmera está em uso por outro aplicativo (Teams, Meet, Zoom, outra aba). Feche e tente novamente." : `Não foi possível ativar a câmera. Tente novamente (id ${errorId}).`);
      setInstruction("Tente novamente");
    } finally {
      cameraStartInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (employeeId && confirmedPerson && consent && cameraState === "idle") void startCamera();
  }, [employeeId, confirmedPerson, consent, cameraState]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  function capturePhoto() {
    if (cameraState !== "ready" || modelState !== "ready" || !sessionRef.current || !faceReadyRef.current || submittingRef.current) return;
    const image = captureFrame();
    if (!image) { setError("A câmera ainda não tem uma imagem pronta. Tente novamente."); return; }
    const next = [...samplesRef.current, image];
    samplesRef.current = next;
    setSamples(next);
    setInstruction(`Foto capturada (${next.length}/5)`);
    if (next.length >= REQUIRED_SAMPLES) void submitEnrollment(next);
  }

  function measureFrame(video: HTMLVideoElement, face: FaceResult | null) {
    if (!face?.boxRaw) return { brightness: 0, contrast: 0, sharpness: 0, movement: 1 };
    const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { brightness: 0, contrast: 0, sharpness: 0, movement: 1 };
    const [x, y, width, height] = face.boxRaw;
    context.drawImage(video, x * video.videoWidth, y * video.videoHeight, width * video.videoWidth, height * video.videoHeight, 0, 0, 96, 96);
    const pixels = context.getImageData(0, 0, 96, 96).data; const luminance: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) luminance.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    const brightness = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
    const contrast = Math.sqrt(luminance.reduce((sum, value) => sum + (value - brightness) ** 2, 0) / luminance.length);
    let edgeTotal = 0; for (let index = 1; index < luminance.length; index += 1) edgeTotal += Math.abs(luminance[index] - luminance[index - 1]);
    const previous = previousBoxRef.current; const centerX = x + width / 2; const centerY = y + height / 2;
    const movement = previous ? Math.hypot(centerX - (previous[0] + previous[2] / 2), centerY - (previous[1] + previous[3] / 2)) / Math.max(width, 0.01) : 0;
    previousBoxRef.current = face.boxRaw;
    return { brightness, contrast, sharpness: edgeTotal / luminance.length, movement };
  }

  async function submitEnrollment(nextSamples: string[]) {
    const current = sessionRef.current;
    if (submittingRef.current || !current || nextSamples.length < REQUIRED_SAMPLES) return;
    submittingRef.current = true; setBusy(true); setInstruction("Processando cadastro...");
    try {
      const response = await fetch("/api/admin/face-enrollment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token, consent: true, consentAt: new Date().toISOString(), samples: nextSamples }) });
      const data = await response.json();
      console.info("[face-enroll] backend-response", { elapsedMs: Math.round(performance.now() - openedAtRef.current), status: response.status, code: data.code });
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir o cadastro.");
      setMessage("Cadastro concluído"); setInstruction("Cadastro concluído"); stopCamera();
    } catch (cause) {
      const code = cause instanceof Error && "code" in cause ? String((cause as Error & { code?: string }).code) : "BACKEND_REJECTED";
      console.error("[face-enroll] submit", code, cause);
      setError(`${cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro."}${process.env.NODE_ENV !== "production" ? ` (${code})` : ""}`); setInstruction("Tente novamente");
    } finally { submittingRef.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (cameraState !== "ready" || modelState !== "ready") return;
    let stopped = false; let pending = false; let lastRun = 0; let frame = 0;
    const detect = async (time: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(detect);
      if (document.hidden || pending || time - lastRun < 33 || !videoRef.current || !humanRef.current) return;
      lastRun = time; pending = true;
      try {
        const result = await humanRef.current.detect(videoRef.current);
        const faceCount = result.face?.length ?? 0;
        const face = faceCount === 1 ? result.face![0] : null;
        faceReadyRef.current = Boolean(face);
        if (lastFaceDetectedRef.current !== Boolean(face)) { lastFaceDetectedRef.current = Boolean(face); setFaceDetected(Boolean(face)); }
        const canvas = overlayRef.current; const video = videoRef.current;
        if (canvas && video) { canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; const context = canvas.getContext("2d"); context?.clearRect(0, 0, canvas.width, canvas.height); if (face?.mesh) { context!.fillStyle = "rgb(255 255 255 / 70%)"; for (const point of face.mesh) { context!.beginPath(); context!.arc(point[0] ?? 0, point[1] ?? 0, 1.2, 0, Math.PI * 2); context!.fill(); } } }
        const metrics = measureFrame(videoRef.current, face);
        const now = performance.now();
        movementEmaRef.current = DEBUG_MOVEMENT_EMA_ALPHA * metrics.movement + (1 - DEBUG_MOVEMENT_EMA_ALPHA) * movementEmaRef.current;
        const box = face?.boxRaw;
        const centerX = box ? box[0] + box[2] / 2 : 0;
        const centerY = box ? box[1] + box[3] / 2 : 0;
        const yaw = face?.rotation?.angle?.yaw ?? 0;
        const pitch = face?.rotation?.angle?.pitch ?? 0;
        const roll = face?.rotation?.angle?.roll ?? 0;
        const checks: DebugCheck[] = [
          { name: "rostos", value: String(faceCount), threshold: "= 1", pass: faceCount === 1 },
          { name: "centralização", value: `${centerX.toFixed(3)}, ${centerY.toFixed(3)}`, threshold: "X 0.35-0.65 / Y 0.25-0.75", pass: Boolean(box && centerX > 0.35 && centerX < 0.65 && centerY > 0.25 && centerY < 0.75) },
          { name: "tamanho", value: box ? box[2].toFixed(3) : "-", threshold: "0.22-0.72", pass: Boolean(box && box[2] > 0.22 && box[2] < 0.72) },
          { name: "yaw", value: yaw.toFixed(2), threshold: "-15..15", pass: Math.abs(yaw) <= 15 },
          { name: "pitch", value: pitch.toFixed(2), threshold: "-15..15", pass: Math.abs(pitch) <= 15 },
          { name: "roll", value: roll.toFixed(2), threshold: "-12..12", pass: Math.abs(roll) <= 12 },
          { name: "brilho", value: metrics.brightness.toFixed(2), threshold: `>= ${DEBUG_BRIGHTNESS_MIN}`, pass: metrics.brightness >= DEBUG_BRIGHTNESS_MIN },
          { name: "contraste", value: metrics.contrast.toFixed(2), threshold: `>= ${DEBUG_CONTRAST_MIN}`, pass: metrics.contrast >= DEBUG_CONTRAST_MIN },
          { name: "nitidez", value: metrics.sharpness.toFixed(2), threshold: `>= ${DEBUG_SHARPNESS_MIN}`, pass: metrics.sharpness >= DEBUG_SHARPNESS_MIN },
          { name: "movimento/rosto", value: movementEmaRef.current.toFixed(4), threshold: `<= ${DEBUG_MOVEMENT_MAX_RATIO}`, pass: movementEmaRef.current <= DEBUG_MOVEMENT_MAX_RATIO },
          { name: "olhos abertos", value: face?.annotations?.leftEye ? "landmark disponível" : "indisponível (não bloqueia)", threshold: "landmarks", pass: true },
          { name: "sessão", value: sessionRef.current ? "pronta" : "ausente", threshold: "pronta", pass: Boolean(sessionRef.current) },
        ];
        if (captureStartedAtRef.current && now - captureStartedAtRef.current > DEBUG_CAPTURE_TIMEOUT_MS && samplesRef.current.length < REQUIRED_SAMPLES) {
          setError(`A captura excedeu 20 s. Primeira falha: ${checks.find((check) => !check.pass)?.name ?? "sessão ou modelos"}. Reinicie.`);
          setInstruction("Reinicie a captura");
          captureStartedAtRef.current = now;
        }
        const physicalPass = checks.slice(0, 10).every((check) => check.pass);
        stabilityRef.current = advanceFaceStability(stabilityRef.current, now, physicalPass && Boolean(face));
        if (now - lastDebugAtRef.current > 100) {
          const firstFail = checks.find((check) => !check.pass)?.name ?? "nenhuma";
          setDebugSnapshot({ checks, stabilityMs: stabilityRef.current.accumulatedMs, requiredMs: DEBUG_REQUIRED_STABLE_MS, stage: samplesRef.current.length >= REQUIRED_SAMPLES ? "finalização" : "captura automática", model: modelState, session: sessionRef.current ? "pronta" : "ausente", service: process.env.NEXT_PUBLIC_FACE_SERVICE_URL ? "configurado" : "não configurado", firstFail });
          lastDebugAtRef.current = now;
        }
        if (!face) { setInstruction(result.face?.length ? "Mais de um rosto na câmera" : "Posicione o rosto na oval"); return; }
        if (!sessionRef.current) { setInstruction("Criando sessão..."); return; }
        if (!physicalPass) { const firstFail = checks.find((check) => !check.pass)?.name; setInstruction(firstFail === "brilho" ? "Procure um local mais iluminado" : firstFail === "nitidez" ? "Fique parado para melhorar a nitidez" : firstFail === "movimento/rosto" ? "Fique parado" : "Posicione o rosto na oval"); return; }
        if (stabilityRef.current.accumulatedMs >= DEBUG_REQUIRED_STABLE_MS && samplesRef.current.length < 5 && !submittingRef.current) {
          const image = captureFrame();
          if (image) { const next = [...samplesRef.current, image]; samplesRef.current = next; setSamples(next); stabilityRef.current = { accumulatedMs: 0, lastAt: now, badSince: 0 }; setInstruction(`Câmera ativa (${next.length}/5)`); if (next.length >= REQUIRED_SAMPLES) void submitEnrollment(next); }
        }
      } catch (cause) { const errorId = crypto.randomUUID(); console.error("Falha ao processar quadro facial", { errorId, errorName: cause instanceof Error ? cause.name : "UnknownError" }); setError(`Não foi possível processar a câmera (id ${errorId}).`); } finally { pending = false; }
    };
    frame = requestAnimationFrame(detect);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [cameraState, modelState]);

  const employee = employees.find((item) => item.id === Number(employeeId));
  const requirement = !employeeId ? "Selecione o funcionário" : !confirmedPerson ? "Marque a confirmação da pessoa" : !consent ? "Marque o consentimento" : "";
  const progress = Math.min(100, samples.length * 20);

  return <main className={styles.page}><header className={styles.header}><p className={styles.eyebrow}>Administração</p><h1>Cadastro facial presencial</h1><p>Imagens processadas em memória. Apenas o template matemático cifrado é mantido.</p></header>{(error || message) && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.success}>{error || message}</p>}<section className={styles.panel} aria-busy={busy}><label className={styles.field}>Funcionário<select value={employeeId} disabled={cameraState === "ready" || busy} onChange={(event) => selectEmployee(event.target.value)}><option value="">Selecione</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.cracha}{item.enrolled ? " · rosto cadastrado" : " · pendente"}</option>)}</select></label>{employee && <p className={styles.target}><strong>{employee.nome}</strong> · crachá {employee.cracha}</p>}<div className={`${styles.scanner} ${message ? styles.scannerSuccess : ""}`}><video ref={videoRef} autoPlay muted playsInline className={styles.video} aria-label="Prévia da câmera para cadastro facial" /><canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" /><div className={styles.oval} aria-hidden="true" style={{ "--progress": `${progress}%` } as CSSProperties} /><p className={styles.instruction} aria-live="polite">{cameraState === "starting" ? "Ativando câmera..." : cameraState === "ready" ? instruction : "A câmera está pronta para ser ativada"}</p>{cameraState !== "ready" && <button type="button" className={styles.cameraStart} disabled={Boolean(requirement) || cameraState === "starting"} onClick={() => void startCamera()}>{cameraState === "starting" ? "Ativando câmera..." : "Ativar câmera"}</button>}{requirement && <p className={styles.cameraRequirement}>{requirement}</p>}{error && <p role="alert" className={styles.cameraError}>{error}</p>}</div>{cameraDevices.length > 1 && <label className={styles.field}>Câmera<select className={styles.cameraSelector} value={cameraDeviceId} onChange={(event) => { setCameraDeviceId(event.target.value); void startCamera(); }}>{cameraDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${index + 1}`}</option>)}</select></label>}<p className={styles.modelStatus}>{modelState === "loading" ? "Carregando modelos..." : modelState === "error" ? "Modelos indisponíveis; a câmera continua disponível." : "Câmera e modelos prontos."}</p><label className={styles.consent}><input type="checkbox" checked={confirmedPerson} onChange={(event) => setConfirmedPerson(event.target.checked)} /><span>Confirmo que a pessoa diante da câmera é {employee?.nome ?? "o funcionário selecionado"} (crachá {employee?.cracha ?? ""}).</span></label><label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{faceConsentText}</span></label><div className={styles.actions}><button type="button" className={styles.primary} disabled={Boolean(requirement) || cameraState === "starting"} onClick={() => void startCamera()}>{cameraState === "ready" ? "Reiniciar" : "Ativar câmera"}</button><button type="button" className={styles.primary} disabled={cameraState !== "ready" || modelState !== "ready" || !faceDetected || samples.length >= 5 || busy} onClick={capturePhoto}>Capturar foto</button><button type="button" onClick={stopCamera}>Cancelar</button></div></section>{process.env.NODE_ENV !== "production" && debugSnapshot && <aside className={styles.debugPanel} aria-label="Diagnóstico da captura"><strong>Diagnóstico da captura (desenvolvimento)</strong><span>Etapa: {debugSnapshot.stage} | Primeira falha: {debugSnapshot.firstFail}</span><span>Estabilidade: {debugSnapshot.stabilityMs.toFixed(0)} / {debugSnapshot.requiredMs} ms</span><span>Modelos: {debugSnapshot.model} | Sessão: {debugSnapshot.session} | FACE_SERVICE_URL: {debugSnapshot.service}</span>{debugSnapshot.checks.map((check) => <span key={check.name} className={check.pass ? styles.debugPass : styles.debugFail}>{check.pass ? "PASS" : "FAIL"} {check.name}: {check.value} (limiar {check.threshold})</span>)}</aside>}</main>;
}
