"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { faceConsentText } from "@/lib/face-consent";
import styles from "./face-enrollment.module.css";

type Employee = { id: number; nome: string; cracha: string; enrolled: boolean };
type Session = { id: string; token: string; expiraEm: string };
type Stage = "front" | "left" | "right" | "blink" | "success" | "failed";

type FaceResult = { mesh?: Array<Array<number | undefined>>; boxRaw: [number, number, number, number]; annotations?: Record<string, Array<Array<number | undefined>>>; rotation?: { angle: { roll: number; yaw: number; pitch: number } } | null };
type HumanDetector = { detect(input: HTMLVideoElement): Promise<{ face?: FaceResult[] }> };
const BRIGHTNESS_MIN = 42;
const BRIGHTNESS_MAX = 218;
const SHARPNESS_MIN = 16;
const FACE_SIZE_MIN = 0.22;
const FACE_SIZE_MAX = 0.72;
const YAW_LIMIT = 15;
const PITCH_LIMIT = 15;
const ROLL_LIMIT = 12;
const STABLE_MS = 1000;

function eyesAreOpen(face: FaceResult) {
  const left = face.annotations?.leftEye ?? [];
  const right = face.annotations?.rightEye ?? [];
  const ratio = (eye: Array<Array<number | undefined>>) => {
    if (eye.length < 4) return 1;
    const xs = eye.map((point) => point[0] ?? 0); const ys = eye.map((point) => point[1] ?? 0);
    return (Math.max(...ys) - Math.min(...ys)) / Math.max(1, Math.max(...xs) - Math.min(...xs));
  };
  return ratio(left) > 0.12 && ratio(right) > 0.12;
}

function inspectLight(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 72;
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
  const [modelState, setModelState] = useState<"loading" | "ready" | "error">("loading");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "ready" | "denied" | "missing">("idle");
  const [instruction, setInstruction] = useState("Carregando modelos de visão");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanDetector | null>(null);
  const stageRef = useRef<Stage>("front");
  const sessionRef = useRef<Session | null>(null);
  const samplesRef = useRef<string[]>([]);
  const stableSinceRef = useRef(0);
  const capturedStageRef = useRef<Stage | null>(null);
  const submittingRef = useRef(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }

  async function loadModels() {
    try {
      const loadBrowserModule = new Function("url", "return import(url)") as (url: string) => Promise<{ default: new (config: Record<string, unknown>) => HumanDetector & { load(): Promise<void>; warmup(): Promise<void> } }>;
      const { default: Human } = await loadBrowserModule("https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.esm.js");
      let human = new Human({ backend: "webgl", modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/", cacheModels: true, debug: false, face: { detector: { maxDetected: 2, minConfidence: 0.6, rotation: true }, mesh: { enabled: true }, description: { enabled: true }, iris: { enabled: true } } });
      try { await human.load(); await human.warmup(); } catch { human = new Human({ backend: "cpu", modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/", cacheModels: true, debug: false }); await human.load(); await human.warmup(); }
      humanRef.current = human; setModelState("ready"); setInstruction("Selecione o funcionário e confirme a pessoa diante da câmera");
    } catch { setModelState("error"); setInstruction("Não foi possível carregar os modelos. Tente novamente."); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadModels(); void fetch("/api/admin/face-enrollment").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os funcionários."); setEmployees(data.employees ?? []); const saved = localStorage.getItem("marcon-face-enrollment-session"); if (saved) { try { const restored = JSON.parse(saved) as { employeeId: string; session: Session }; const renewed = await fetch("/api/admin/face-enrollment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(restored.employeeId), sessionId: restored.session.id, sessionToken: restored.session.token }) }); if (renewed.ok) { const renewal = await renewed.json(); setEmployeeId(restored.employeeId); setSession({ ...restored.session, expiraEm: renewal.expiraEm }); } else localStorage.removeItem("marcon-face-enrollment-session"); } catch { localStorage.removeItem("marcon-face-enrollment-session"); } } }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os funcionários.")); }, 0); return () => { window.clearTimeout(timer); stopCamera(); }; }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { if (session && employeeId) localStorage.setItem("marcon-face-enrollment-session", JSON.stringify({ employeeId, session })); }, [employeeId, session]);
  useEffect(() => { samplesRef.current = samples; }, [samples]);

  async function selectEmployee(value: string) {
    stopCamera(); setEmployeeId(value); setSession(null); localStorage.removeItem("marcon-face-enrollment-session"); setSamples([]); samplesRef.current = []; setConfirmedPerson(false); setConsent(false); setError(""); setMessage("");
    if (!value) return;
    const response = await fetch(`/api/admin/face-enrollment?funcionarioId=${encodeURIComponent(value)}`); const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Não foi possível iniciar a sessão."); return; }
    setSession(data.session); sessionRef.current = data.session;
  }

  async function renewSession() {
    const current = sessionRef.current; if (!current || !employeeId) return false;
    const response = await fetch("/api/admin/face-enrollment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token }) });
    if (!response.ok) return false; const data = await response.json(); setSession({ ...current, expiraEm: data.expiraEm }); return true;
  }

  async function startCamera() {
    if (!confirmedPerson || !consent || modelState !== "ready") return;
    setError(""); setCameraState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("missing", "NotFoundError");
      stopCamera(); streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = streamRef.current; await videoRef.current.play(); }
      setCameraState("ready"); setStage("front"); stageRef.current = "front"; capturedStageRef.current = null; setInstruction("Posicione o rosto na oval");
    } catch (cause) { const name = cause instanceof DOMException ? cause.name : ""; setCameraState(name === "NotFoundError" ? "missing" : "denied"); setError(name === "NotFoundError" ? "Nenhuma câmera foi encontrada." : "Permita a câmera nas configurações do navegador e tente novamente."); }
  }

  function captureFrame() {
    const video = videoRef.current; if (!video) return null;
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", 0.86);
  }

  async function submitEnrollment(nextSamples: string[]) {
    if (submittingRef.current || nextSamples.length < 3 || !sessionRef.current) return;
    submittingRef.current = true; setBusy(true); setInstruction("Processando e confirmando o cadastro");
    const current = sessionRef.current;
    try {
      const response = await fetch("/api/admin/face-enrollment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: Number(employeeId), sessionId: current.id, sessionToken: current.token, consent: true, consentAt: new Date().toISOString(), samples: nextSamples }) });
      const data = await response.json();
      if (response.status === 409 && data.code === "FACE_ENROLLMENT_SESSION_EXPIRED" && await renewSession()) { submittingRef.current = false; setBusy(false); await submitEnrollment(nextSamples); return; }
      if (response.status === 429) { setError(`${data.error} Tente novamente em ${Math.ceil(Number(response.headers.get("Retry-After") ?? 60) / 60)} minutos.`); setStage("failed"); return; }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir o cadastro.");
      setMessage("Cadastro concluído"); setInstruction("Cadastro concluído"); setStage("success"); localStorage.removeItem("marcon-face-enrollment-session"); stopCamera(); setEmployees((currentEmployees) => currentEmployees.map((item) => item.id === Number(employeeId) ? { ...item, enrolled: true } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro."); setInstruction("Tente novamente"); setStage("failed"); }
    finally { submittingRef.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (cameraState !== "ready" || modelState !== "ready") return;
    let stopped = false; let pending = false; let lastRun = 0; let frame = 0;
    const stages: Stage[] = ["front", ...(Math.random() > 0.5 ? ["left", "right"] as Stage[] : ["right", "left"] as Stage[]), "blink"];
    const detect = async (time: number) => {
      if (stopped) return; frame = requestAnimationFrame(detect); if (document.hidden || pending || time - lastRun < 33 || !videoRef.current || !humanRef.current) return; lastRun = time; pending = true;
      try {
        const result = await humanRef.current.detect(videoRef.current); const face = result.face?.length === 1 ? result.face[0] : null; drawMesh(overlayRef.current!, videoRef.current, face);
        if (!face) { stableSinceRef.current = 0; setInstruction(result.face?.length ? "Mais de um rosto na câmera" : "Posicione o rosto na oval"); return; }
        const light = inspectLight(videoRef.current); const box = face.boxRaw; const center = box[0] + box[2] / 2 > 0.35 && box[0] + box[2] / 2 < 0.65 && box[1] + box[3] / 2 > 0.25 && box[1] + box[3] / 2 < 0.75; const size = box[2] > FACE_SIZE_MIN && box[2] < FACE_SIZE_MAX; const rotation = face.rotation?.angle; const front = rotation ? Math.abs(rotation.yaw) <= YAW_LIMIT && Math.abs(rotation.pitch) <= PITCH_LIMIT && Math.abs(rotation.roll) <= ROLL_LIMIT : true; const eyesOpen = eyesAreOpen(face); const ready = center && size && front && light.brightness >= BRIGHTNESS_MIN && light.brightness <= BRIGHTNESS_MAX && light.sharpness >= SHARPNESS_MIN;
        if (!ready) { stableSinceRef.current = 0; setInstruction(!center ? "Posicione o rosto na oval" : !size ? (box[2] < FACE_SIZE_MIN ? "Aproxime-se" : "Afaste-se um pouco") : !front ? "Olhe para a câmera" : light.brightness < BRIGHTNESS_MIN ? "Procure um local mais iluminado" : "Fique parado"); return; }
        const currentStage = stageRef.current; const yaw = face.rotation?.angle.yaw ?? 0; const stagePassed = currentStage === "front" || (currentStage === "left" && yaw < -8) || (currentStage === "right" && yaw > 8) || (currentStage === "blink" && !eyesOpen);
        setInstruction(currentStage === "front" ? "Fique parado" : currentStage === "blink" ? "Pisque" : currentStage === "left" ? "Vire levemente para a esquerda" : "Vire levemente para a direita");
        if (stagePassed) { if (!stableSinceRef.current) stableSinceRef.current = time; if (time - stableSinceRef.current >= STABLE_MS && capturedStageRef.current !== currentStage) { const image = captureFrame(); if (image) { const next = [...samplesRef.current, image]; capturedStageRef.current = currentStage; samplesRef.current = next; setSamples(next); const nextStage = stages[stages.indexOf(currentStage) + 1] ?? "success"; stageRef.current = nextStage; setStage(nextStage); if (nextStage === "success") void submitEnrollment(next); else { stableSinceRef.current = 0; capturedStageRef.current = null; } } } } else stableSinceRef.current = 0;
      } catch { setInstruction("Não foi possível processar o quadro. Tente novamente"); } finally { pending = false; }
    };
    frame = requestAnimationFrame(detect); return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [cameraState, modelState, employeeId]);

  useEffect(() => { if (cameraState !== "ready") return; const timer = window.setInterval(() => { void renewSession(); }, 60_000); return () => window.clearInterval(timer); }, [cameraState, employeeId]);

  const employee = employees.find((item) => item.id === Number(employeeId)); const progress = Math.min(100, samples.length * 20);
  return <main className={styles.page}><header className={styles.header}><p className={styles.eyebrow}>Administração</p><h1>Cadastro facial presencial</h1><p>Imagens processadas em memória. Apenas o template matemático cifrado é mantido.</p></header>{(error || message) && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.success}>{error || message}</p>}<section className={styles.panel} aria-busy={busy}><label className={styles.field}>Funcionário<select value={employeeId} disabled={cameraState === "ready" || busy} onChange={(event) => void selectEmployee(event.target.value)}><option value="">Selecione</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.cracha}{item.enrolled ? " · rosto cadastrado" : " · pendente"}</option>)}</select></label>{employee && <p className={styles.target}><strong>{employee.nome}</strong> · crachá {employee.cracha}</p>}{modelState === "loading" && <p className={styles.modelStatus}>Carregando modelos de visão...</p>}{modelState === "error" && <button type="button" onClick={() => void loadModels()}>Tentar carregar modelos</button>}<div className={`${styles.scanner} ${stage === "success" ? styles.scannerSuccess : ""}`}><video ref={videoRef} muted playsInline className={styles.video} aria-label="Prévia da câmera para cadastro facial" /><canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" /><div className={styles.oval} aria-hidden="true" style={{ "--progress": `${progress}%` } as CSSProperties} /><p className={styles.instruction} aria-live="polite">{cameraState === "starting" ? "Pedindo permissão da câmera" : instruction}</p>{stage === "success" && <span className={styles.check} aria-label="Cadastro concluído">✓</span>}</div><label className={styles.consent}><input type="checkbox" checked={confirmedPerson} onChange={(event) => setConfirmedPerson(event.target.checked)} /><span>Confirmo que a pessoa diante da câmera é {employee?.nome ?? "o funcionário selecionado"} ({employee?.cracha ?? "crachá"}).</span></label><label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{faceConsentText}</span></label><div className={styles.actions}><button type="button" className={styles.primary} disabled={!employee || !confirmedPerson || !consent || modelState !== "ready" || cameraState === "starting"} onClick={() => void startCamera()}>{cameraState === "ready" ? "Reiniciar" : "Iniciar captura"}</button><button type="button" onClick={stopCamera}>Cancelar</button></div></section></main>;
}
