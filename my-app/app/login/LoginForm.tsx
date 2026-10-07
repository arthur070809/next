"use client";

import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCameraStreamController, type CameraStreamController } from "@/lib/camera/camera-stream";
import { advanceBlinkState, faceEyeAspectRatio, initialBlinkState, type BlinkState } from "@/lib/facial/blink";
import { isFaceBlinkRequired } from "@/lib/facial/config";
import { canStartAutomaticAttempt, FACE_QUALITY_LIMITS, evaluateFaceQuality, selectDominantFace, shouldFinishFrameCollection } from "@/lib/facial/face-quality";
import { measureFaceFrame } from "@/lib/facial/frame-metrics";
import { selectBestEnrollmentFrames, type ScoredEnrollmentFrame } from "@/lib/facial/enrollment-capture";
import { extractFaceEmbedding, loadBrowserHuman, loadFaceDescriptor, loadFaceEmotion, type BrowserHuman } from "@/lib/facial/human-browser";
import BadgeBarcodeScanner from "@/app/components/BadgeBarcodeScanner";
import { advanceFromBadgeFieldOnEnter, isValidBadgeCode, normalizeBadgeCode } from "@/lib/badge-code";
import {
  createFaceLoadDiagnostics,
  faceCameraConstraintFallbacks,
  startCameraWithConstraintFallback,
  startFaceLoadWatchdog,
  withFaceLoadError,
} from "@/lib/facial/load-diagnostics";
import { cameraErrorMessage } from "@/lib/qr/camera-utils";
import BuildIdentifier from "@/app/components/BuildIdentifier";
import { Button, Card, Field } from "@/app/components/ui";
import Image from "next/image";

type LoginResult = { funcionario: { role: string; mustChangePassword: boolean } };
type FaceChallenge = {
  challengeId: string;
  loginToken?: string;
  nonce: string;
  challenge: string;
  expiresAt: string;
};
type LoginResponse = {
  error?: string;
  step?: string;
  preAuthToken?: string;
  challengeId?: string;
  loginToken?: string;
  nonce?: string;
  challenge?: string;
  expiresAt?: string;
  options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
  funcionario?: LoginResult["funcionario"];
};
type Stage = "code" | "totp" | "face";
type FaceCameraState = "idle" | "starting" | "ready" | "paused" | "error" | "exhausted";
type FaceCandidate = ScoredEnrollmentFrame<number[]>;

export default function LoginForm({
  sessionExpired = false,
  demoPhotoMode = false,
}: {
  sessionExpired?: boolean;
  demoPhotoMode?: boolean;
}) {
  const router = useRouter();
  const [codigoCracha, setCodigoCracha] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("code");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [faceChallenge, setFaceChallenge] = useState<FaceChallenge | null>(null);
  const [faceModelProgress, setFaceModelProgress] = useState("Carregando reconhecedor local");
  const [faceModelReady, setFaceModelReady] = useState(false);
  const [faceModelState, setFaceModelState] = useState<"loading" | "slow" | "error" | "ready">("loading");
  const [faceModelErrorName, setFaceModelErrorName] = useState("");
  const [cameraState, setCameraState] = useState<FaceCameraState>("idle");
  const [demoFaceDetected, setDemoFaceDetected] = useState(false);
  const [automaticAttempts, setAutomaticAttempts] = useState(0);
  const [cameraRestartKey, setCameraRestartKey] = useState(0);
  const [modelRetryKey, setModelRetryKey] = useState(0);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceCameraRef = useRef<CameraStreamController | null>(null);
  const faceHumanRef = useRef<BrowserHuman | null>(null);
  const faceChallengeRef = useRef<FaceChallenge | null>(null);
  const attemptCountRef = useRef(0);
  const lastAttemptAtRef = useRef(0);
  const attemptInFlightRef = useRef(false);
  const submitAutomaticFaceAttemptRef = useRef<(embedding: number[]) => Promise<void>>(async () => undefined);
  const invalidSinceRef = useRef(0);
  const collectionStartedAtRef = useRef(0);
  const faceCandidatesRef = useRef<FaceCandidate[]>([]);
  const blinkStateRef = useRef<BlinkState>(initialBlinkState);
  const leftTurnObservedRef = useRef(false);
  const faceLoadDiagnosticsRef = useRef(createFaceLoadDiagnostics());
  const faceLoadWatchdogRef = useRef<ReturnType<typeof startFaceLoadWatchdog> | null>(null);

  useEffect(() => {
    if (stage === "code" && window.matchMedia("(min-width: 768px)").matches) {
      codeInputRef.current?.focus();
    }
  }, [stage]);

  function stopFaceCamera() {
    const camera = faceCameraRef.current;
    faceCameraRef.current = null;
    if (camera) camera.dispose();
    else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    faceCandidatesRef.current = [];
    collectionStartedAtRef.current = 0;
  }

  useEffect(() => () => faceCameraRef.current?.dispose(), []);
  useEffect(() => () => faceLoadWatchdogRef.current?.clear(), []);

  useEffect(() => {
    if (stage !== "face") return;
    let cancelled = false;
    const watchdog = startFaceLoadWatchdog(
      () => {
        if (!cancelled) {
          setFaceModelState("slow");
          setFaceModelProgress("Conexão lenta; os modelos ainda estão carregando");
        }
      },
      () => {
        if (!cancelled) {
          setFaceModelState("error");
          setFaceModelErrorName("TimeoutError");
          setError("O carregamento facial excedeu 60 segundos. Recomece a verificação.");
          faceLoadDiagnosticsRef.current = withFaceLoadError(
            faceLoadDiagnosticsRef.current,
            Object.assign(new Error("Tempo limite de 60 segundos excedido."), { name: "TimeoutError" }),
          );
        }
      },
    );
    faceLoadWatchdogRef.current = watchdog;
    const callbacks = {
      onProgress: setFaceModelProgress,
      onDiagnostics: (diagnostics: typeof faceLoadDiagnosticsRef.current) => {
        faceLoadDiagnosticsRef.current = diagnostics;
      },
    };
    const initialDiagnostics = { ...createFaceLoadDiagnostics(), startedAt: Date.now(), stage: "checando-backend" as const };
    void loadBrowserHuman(callbacks, initialDiagnostics).then(async ({ human }) => {
      await loadFaceDescriptor(human, callbacks, faceLoadDiagnosticsRef.current);
      const challenge = faceChallengeRef.current?.challenge;
      if (isFaceBlinkRequired() && (challenge === "sorrir" || challenge === "smile")) {
        await loadFaceEmotion(human, callbacks, faceLoadDiagnosticsRef.current);
      }
      if (cancelled || watchdog.didTimeout()) return;
      if (!cancelled) {
        watchdog.clear();
        faceHumanRef.current = human;
        setFaceModelReady(true);
        setFaceModelState("ready");
      }
    }).catch((cause: unknown) => {
      if (!cancelled && !watchdog.didTimeout()) {
        const name = cause instanceof Error ? cause.name : "UnknownError";
        watchdog.clear();
        faceLoadDiagnosticsRef.current = withFaceLoadError(faceLoadDiagnosticsRef.current, cause);
        setFaceModelErrorName(name);
        setFaceModelState("error");
        setError(`Não foi possível carregar os modelos faciais (${name}). Tente novamente.`);
      }
    });
    return () => {
      cancelled = true;
      watchdog.clear();
      faceHumanRef.current = null;
      setFaceModelReady(false);
    };
  }, [stage, modelRetryKey]);

  function retryFaceModelLoad() {
    if (faceModelState === "slow" || faceModelErrorName === "TimeoutError") {
      window.location.reload();
      return;
    }
    setError("");
    setFaceModelReady(false);
    setFaceModelState("loading");
    setFaceModelErrorName("");
    setModelRetryKey((key) => key + 1);
  }

  function completeLogin(data: LoginResult) {
    const destination = data.funcionario.role === "admin"
      ? "/admin"
      : data.funcionario.role === "operador"
        ? "/requisicao"
        : "/almoxarifado";
    router.replace(data.funcionario.role !== "admin" && data.funcionario.mustChangePassword
      ? `/alterar-senha?next=${destination}`
      : destination);
  }

  async function readResponse(response: Response): Promise<LoginResponse> {
    const data = await response.json() as LoginResponse;
    if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir o login.");
    return data;
  }

  function acceptFaceChallenge(data: LoginResponse) {
    if (!data.challengeId || !data.nonce || !data.challenge || !data.expiresAt) {
      throw new Error("Não foi possível iniciar a verificação facial.");
    }
    const challenge = {
      challengeId: data.challengeId,
      ...(data.loginToken ? { loginToken: data.loginToken } : {}),
      nonce: data.nonce,
      challenge: data.challenge,
      expiresAt: data.expiresAt,
    };
    faceChallengeRef.current = challenge;
    setFaceChallenge(challenge);
    attemptCountRef.current = 0;
    lastAttemptAtRef.current = 0;
    setAutomaticAttempts(0);
    invalidSinceRef.current = 0;
    faceCandidatesRef.current = [];
    collectionStartedAtRef.current = 0;
    blinkStateRef.current = initialBlinkState;
    leftTurnObservedRef.current = false;
    setFaceModelReady(false);
    setFaceModelState("loading");
    setFaceModelErrorName("");
    setStage("face");
  }

  async function handleLoginResponse(response: Response) {
    const data = await readResponse(response);
    if (response.status === 202 && data.step === "totp" && data.preAuthToken) {
      setPreAuthToken(data.preAuthToken);
      setStage("totp");
      return;
    }
    if (response.status === 202 && data.step === "face") {
      acceptFaceChallenge(data);
      return;
    }
    if (response.status === 202 && data.step === "webauthn" && data.options && data.challengeId) {
      const credential = await startAuthentication({ optionsJSON: data.options });
      const verified = await fetch("/api/auth/login/webauthn/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: data.challengeId, credential }),
      });
      const verifiedData = await readResponse(verified);
      if (verifiedData.step === "face") {
        acceptFaceChallenge(verifiedData);
        return;
      }
      if (verifiedData.funcionario) completeLogin({ funcionario: verifiedData.funcionario });
      else throw new Error("Não foi possível concluir o login.");
      return;
    }
    if (data.funcionario) {
      completeLogin({ funcionario: data.funcionario });
      return;
    }
    throw new Error("Não foi possível concluir o login.");
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    const normalizedCode = normalizeBadgeCode(codigoCracha);
    if (!isValidBadgeCode(normalizedCode)) {
      setError("O crachá deve conter de 4 a 10 dígitos.");
      codeInputRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoCracha: normalizedCode, credential: "password", password: senha }),
      });
      await handleLoginResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível comunicar com o servidor.");
      (senha ? passwordInputRef.current : codeInputRef.current)?.focus();
    } finally {
      setLoading(false);
    }

  }

  function setFreshChallenge(data: LoginResponse) {
    if (!data.challengeId || !data.nonce || !data.challenge || !data.expiresAt) {
      throw new Error("Não foi possível iniciar a verificação facial.");
    }
    const challenge = {
      challengeId: data.challengeId,
      ...(data.loginToken ? { loginToken: data.loginToken } : {}),
      nonce: data.nonce,
      challenge: data.challenge,
      expiresAt: data.expiresAt,
    };
    faceChallengeRef.current = challenge;
    setFaceChallenge(challenge);
    blinkStateRef.current = initialBlinkState;
    leftTurnObservedRef.current = false;
    faceCandidatesRef.current = [];
    collectionStartedAtRef.current = 0;
    invalidSinceRef.current = 0;
  }

  async function requestFreshFaceChallenge() {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoCracha: normalizeBadgeCode(codigoCracha), credential: "face" }),
    });
    const data = await response.json() as LoginResponse;
    if (!response.ok || response.status !== 202 || data.step !== "face") {
      throw new Error("Não foi possível iniciar uma nova tentativa.");
    }
    setFreshChallenge(data);
  }

  async function submitAutomaticFaceAttempt(embedding: number[]) {
    const now = Date.now();
    if (!canStartAutomaticAttempt({
      attempts: attemptCountRef.current,
      lastAttemptAt: lastAttemptAtRef.current,
      now,
      inFlight: attemptInFlightRef.current,
    })) return;
    const challenge = faceChallengeRef.current;
    if (!challenge) return;
    attemptInFlightRef.current = true;
    setAttemptBusy(true);
    attemptCountRef.current += 1;
    lastAttemptAtRef.current = now;
    setAutomaticAttempts(attemptCountRef.current);
    faceCandidatesRef.current = [];
    collectionStartedAtRef.current = 0;
    try {
      const response = await fetch("/api/auth/login/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          ...(challenge.loginToken ? { loginToken: challenge.loginToken } : {}),
          nonce: challenge.nonce,
          embedding,
          challengeCompleted: true,
        }),
      });
      const data = await response.json() as LoginResponse;
      if (response.ok && data.funcionario) {
        stopFaceCamera();
        completeLogin({ funcionario: data.funcionario });
        return;
      }
      if (response.status === 401
        && attemptCountRef.current < FACE_QUALITY_LIMITS.maximumAutomaticAttempts) {
        setError("");
        const waitMs = Math.max(0, FACE_QUALITY_LIMITS.automaticAttemptIntervalMs - (Date.now() - now));
        if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        await requestFreshFaceChallenge();
        return;
      }
      stopFaceCamera();
      if (response.status === 429) {
        setCameraState("exhausted");
        setError("Muitas tentativas. Aguarde antes de recomeçar.");
      } else if (attemptCountRef.current >= FACE_QUALITY_LIMITS.maximumAutomaticAttempts) {
        setCameraState("exhausted");
        setError("Não foi possível confirmar o acesso. Toque para tentar novamente.");
      } else {
        setCameraState("error");
        setError("Não foi possível confirmar o acesso. Tente novamente.");
      }
    } catch {
      stopFaceCamera();
      setCameraState("error");
      setError("Não foi possível confirmar o acesso. Tente novamente.");
    } finally {
      attemptInFlightRef.current = false;
      setAttemptBusy(false);
    }
  }
  useEffect(() => {
    submitAutomaticFaceAttemptRef.current = submitAutomaticFaceAttempt;
  });

  async function restartFaceSession() {
    setError("");
    stopFaceCamera();
    attemptCountRef.current = 0;
    lastAttemptAtRef.current = 0;
    attemptInFlightRef.current = false;
    setAttemptBusy(false);
    setAutomaticAttempts(0);
    setDemoFaceDetected(false);
    try {
      await requestFreshFaceChallenge();
      setCameraState("idle");
      setCameraRestartKey((key) => key + 1);
    } catch {
      setCameraState("error");
      setError("Não foi possível iniciar uma nova tentativa. Tente novamente.");
    }
  }

  async function openDemoFaceCamera() {
    if (!demoPhotoMode || cameraState === "starting" || attemptBusy) return;
    setError("");
    setDemoFaceDetected(false);
    setCameraState("starting");
    const camera = createCameraStreamController({
      video: videoRef.current,
      onLifecycleStop: (reason) => {
        if (reason === "visibilitychange") {
          setCameraState("paused");
          setError("Câmera pausada ao sair desta tela. Toque para recomeçar.");
        }
      },
    });
    faceCameraRef.current?.dispose();
    faceCameraRef.current = camera;
    try {
      await startCameraWithConstraintFallback(
        (constraints) => camera.start(constraints),
        faceCameraConstraintFallbacks(),
      );
      setCameraState("ready");
    } catch (cause) {
      camera.dispose();
      if (faceCameraRef.current === camera) faceCameraRef.current = null;
      setCameraState("error");
      setError(cameraErrorMessage(cause));
    }
  }

  async function submitDemoFaceAttempt() {
    if (!demoPhotoMode || cameraState !== "ready" || attemptInFlightRef.current) return;
    const detectorUnavailable = faceModelState === "error" || faceModelState === "slow";
    if (!demoFaceDetected && !detectorUnavailable) return;
    const challenge = faceChallengeRef.current;
    if (!challenge) return;
    attemptInFlightRef.current = true;
    setAttemptBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          ...(challenge.loginToken ? { loginToken: challenge.loginToken } : {}),
          nonce: challenge.nonce,
          challengeCompleted: true,
          demoPhotoLogin: true,
          demoFaceDetected,
          demoDetectorUnavailable: detectorUnavailable,
        }),
      });
      const data = await response.json() as LoginResponse;
      if (!response.ok || !data.funcionario) {
        throw new Error(data.error ?? "Não foi possível confirmar o acesso. Tente novamente.");
      }
      stopFaceCamera();
      completeLogin({ funcionario: data.funcionario });
    } catch (cause) {
      stopFaceCamera();
      setCameraState("error");
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o acesso. Tente novamente.");
    } finally {
      attemptInFlightRef.current = false;
      setAttemptBusy(false);
    }
  }

  useEffect(() => {
    if (stage !== "face" || demoPhotoMode || !faceModelReady) return;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    const camera = createCameraStreamController({
      video,
      onLifecycleStop: (reason) => {
        if (reason === "visibilitychange" && !cancelled) {
          setCameraState("paused");
          setError("Câmera pausada ao sair desta tela. Toque para recomeçar.");
        }
      },
    });
    faceCameraRef.current = camera;
    setCameraState("starting");
    setError("");
    void camera.start({
      video: {
        facingMode: "user",
        width: { ideal: FACE_QUALITY_LIMITS.cameraWidth },
        height: { ideal: FACE_QUALITY_LIMITS.cameraHeight },
      },
      audio: false,
    }).then(() => {
      if (!cancelled) setCameraState("ready");
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setCameraState("error");
        setError(cameraErrorMessage(cause));
      }
    });
    return () => {
      cancelled = true;
      camera.dispose();
      if (faceCameraRef.current === camera) faceCameraRef.current = null;
    };
  }, [stage, faceModelReady, cameraRestartKey, demoPhotoMode]);

  useEffect(() => {
    if (stage !== "face" || cameraState !== "ready" || !faceHumanRef.current) return;
    let stopped = false;
    let pending = false;
    let lastRun = 0;
    let animationFrame = 0;
    const detect = async (time: number) => {
      if (stopped) return;
      animationFrame = requestAnimationFrame(detect);
      if (document.hidden || pending || time - lastRun < FACE_QUALITY_LIMITS.analysisIntervalMs) return;
      const video = videoRef.current;
      const human = faceHumanRef.current;
      if (!video || !human || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;
      lastRun = time;
      pending = true;
      try {
        const result = await human.detect(video);
        if (stopped) return;
        const faces = result.face ?? [];
        const face = selectDominantFace(faces, (candidate) => candidate.boxRaw);
        if (demoPhotoMode) {
          setDemoFaceDetected(Boolean(face));
          return;
        }
        if (!face) {
          faceCandidatesRef.current = [];
          collectionStartedAtRef.current = 0;
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setError("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        const light = measureFaceFrame(video);
        const rotation = face.rotation?.angle;
        const mesh = (face.mesh ?? []).map((point) => [point[0] ?? Number.NaN, point[1] ?? Number.NaN]);
        const ear = faceEyeAspectRatio(mesh);
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
        if (!quality.valid) {
          faceCandidatesRef.current = [];
          collectionStartedAtRef.current = 0;
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setError("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        invalidSinceRef.current = 0;
        setError("");
        const challenge = faceChallengeRef.current;
        if (!challenge) return;
        const eyesOpen = ear !== null && ear >= FACE_QUALITY_LIMITS.minimumOpenEyeAspectRatio;
        let livenessPassed = true;
        if (isFaceBlinkRequired() && challenge.challenge === "piscar") {
          if (ear !== null) blinkStateRef.current = advanceBlinkState(blinkStateRef.current, ear, time);
          livenessPassed = blinkStateRef.current.completedAt !== null;
          if (!livenessPassed) return;
        }
        if (!eyesOpen) {
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setError("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        invalidSinceRef.current = 0;
        if (isFaceBlinkRequired()) {
          if (challenge.challenge === "virar_esquerda") {
            if (rotation && rotation.yaw < -10) leftTurnObservedRef.current = true;
            livenessPassed = leftTurnObservedRef.current && Boolean(rotation
              && Math.abs(rotation.yaw) <= FACE_QUALITY_LIMITS.maximumYawDegrees
              && Math.abs(rotation.pitch) <= FACE_QUALITY_LIMITS.maximumPitchDegrees);
          } else {
            livenessPassed = (face.emotion ?? []).some((emotion) => emotion.emotion === "happy" && emotion.score >= 0.6);
          }
        }
        if (!livenessPassed) return;
        const embedding = extractFaceEmbedding(face);
        if (!embedding) {
          if (!invalidSinceRef.current) invalidSinceRef.current = time;
          if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
            setError("Aproxime o rosto e procure mais luz.");
          }
          return;
        }
        if (!collectionStartedAtRef.current) collectionStartedAtRef.current = time;
        faceCandidatesRef.current = [...faceCandidatesRef.current, { frame: embedding, score: quality.score }]
          .slice(-FACE_QUALITY_LIMITS.maximumCandidateFrames);
        const scores = faceCandidatesRef.current.map((candidate) => candidate.score);
        if (shouldFinishFrameCollection({ scores, requestedFrameCount: 1, elapsedMs: time - collectionStartedAtRef.current })) {
          const [best] = selectBestEnrollmentFrames(faceCandidatesRef.current, 1);
          if (best) void submitAutomaticFaceAttemptRef.current(best);
        }
      } catch {
        if (!invalidSinceRef.current) invalidSinceRef.current = time;
        if (time - invalidSinceRef.current >= FACE_QUALITY_LIMITS.noValidFaceMessageDelayMs) {
          setError("Aproxime o rosto e procure mais luz.");
        }
      } finally {
        pending = false;
      }
    };
    animationFrame = requestAnimationFrame(detect);
    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [stage, cameraState, demoPhotoMode, faceModelReady]);

  useEffect(() => () => {
    stopFaceCamera();
  }, []);

  function cancelFace() {
    stopFaceCamera();
    faceChallengeRef.current = null;
    setFaceChallenge(null);
    setCameraState("idle");
    setStage("code");
    setError("");
  }

  async function submitTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || totpCode.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken, code: totpCode }),
      });
      await handleLoginResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar o código.");
      totpInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return <main className="safe-area-inset flex min-h-dvh items-center justify-center bg-background">
    <Card as="section" className="w-full max-w-md overflow-hidden p-0">
      <div className="flex min-h-14 items-center justify-center bg-brand px-4 py-2.5">
        <span className="inline-flex rounded-control bg-surface p-2">
          <Image src="/marcon-logo.svg" width={159} height={31} alt="Marcon Metalúrgicos" priority />
        </span>
      </div>
      <div className="p-5 sm:p-6">
      <Link href="/" className="text-sm font-semibold text-brand hover:text-brand-hover">← Voltar</Link>
      <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{stage === "face" ? "Verificação facial" : stage === "totp" ? "Verificação em duas etapas" : "Entrar com código"}</h1>
      {sessionExpired && <p role="status" className="mt-3 rounded-control bg-warning-surface px-3 py-2 text-sm text-warning">Sessão encerrada por inatividade</p>}
      {stage === "face" && faceChallenge ? <section className="mt-7 space-y-5">
        <p className="text-sm text-text-secondary">{demoPhotoMode
          ? "Abra a câmera. Quando houver um rosto no quadro, toque em Entrar."
          : <>A câmera será iniciada automaticamente. {isFaceBlinkRequired()
          ? faceChallenge.challenge === "piscar" ? "Pisque uma vez quando estiver enquadrado." : faceChallenge.challenge === "virar_esquerda" ? "Vire levemente o rosto à esquerda e volte." : "Sorria levemente quando estiver enquadrado."
          : "O reconhecimento tentará automaticamente quando encontrar um rosto adequado."}</>}</p>
        <div className="overflow-hidden rounded-card bg-brand-pressed"><video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Prévia da câmera" /></div>
        <BuildIdentifier />
        <p className="text-xs text-text-secondary" aria-live="polite">
          {demoPhotoMode
            ? cameraState === "idle" ? "Toque em Abrir câmera"
              : cameraState === "starting" ? "Iniciando câmera…"
                : cameraState === "ready" && faceModelReady ? (demoFaceDetected ? "Rosto detectado" : "Procurando rosto…")
                  : cameraState === "ready" && faceModelState === "error" ? "Detector indisponível; toque em Entrar para continuar"
                    : cameraState === "ready" ? faceModelProgress
                      : cameraState === "paused" ? "Câmera pausada"
                        : cameraState === "exhausted" ? "Limite de tentativas atingido"
                          : "Câmera indisponível"
            : !faceModelReady ? faceModelProgress
            : attemptBusy ? "Processando verificação no servidor…"
              : cameraState === "starting" ? "Iniciando câmera…"
                : cameraState === "ready" ? `Procurando rosto · tentativas ${automaticAttempts}/${FACE_QUALITY_LIMITS.maximumAutomaticAttempts}`
                  : cameraState === "paused" ? "Câmera pausada"
                    : cameraState === "exhausted" ? "Limite de tentativas automáticas atingido"
                      : "Câmera indisponível"}
        </p>
        {!isFaceBlinkRequired() && <p className="rounded-control bg-warning-surface px-3 py-2 text-xs text-warning">
          Modo de teste: sem piscada, uma foto ou vídeo pode passar pela verificação no aparelho. O servidor ainda exige nonce de uso único, limite de tentativas e limiar calibrado.
        </p>}
        {error && <div aria-live="assertive" aria-atomic="true"><p role="alert" className="rounded-control bg-error-surface px-3 py-2 text-sm text-error">{error}</p></div>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" disabled={attemptBusy} onClick={cancelFace} className="flex-1">Cancelar</Button>
          {demoPhotoMode && cameraState !== "ready" && cameraState !== "starting"
              ? <Button disabled={attemptBusy} onClick={() => cameraState === "idle" ? void openDemoFaceCamera() : void restartFaceSession()} className="flex-1">{cameraState === "idle" ? "Abrir câmera" : "Nova tentativa"}</Button>
            : demoPhotoMode && cameraState === "ready"
                ? <Button loading={attemptBusy} disabled={!demoFaceDetected && !["error", "slow"].includes(faceModelState)} loadingLabel="Verificando…" onClick={() => void submitDemoFaceAttempt()} className="flex-1">Entrar</Button>
              : null}
          {!demoPhotoMode && !faceModelReady && faceModelState !== "loading"
              ? <Button variant="secondary" onClick={retryFaceModelLoad} className="flex-1">{faceModelState === "slow" ? "Recomeçar" : "Tentar carregar modelos"}</Button>
            : !demoPhotoMode && ["paused", "error", "exhausted"].includes(cameraState)
                ? <Button disabled={attemptBusy} onClick={() => void restartFaceSession()} className="flex-1">Tentar novamente</Button>
              : null}
        </div>
      </section> : stage === "totp" ? <form onSubmit={(event) => void submitTotp(event)} className="mt-4 grid grid-cols-1 gap-3">
        <p className="text-sm text-text-secondary">Digite o código de 6 dígitos do aplicativo autenticador do administrador.</p>
        <Field label="Código de verificação" htmlFor="totp-code"><input ref={totpInputRef} id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))} className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 text-base text-foreground" /></Field>
        {error && <div aria-live="assertive" aria-atomic="true"><p role="alert" className="rounded-control bg-error-surface px-3 py-2 text-sm text-error">{error}</p></div>}
        <div className="flex flex-col gap-2 sm:flex-row"><Button variant="secondary" disabled={loading} onClick={() => { setStage("code"); setPreAuthToken(""); setTotpCode(""); setError(""); }} className="flex-1">Voltar</Button><Button type="submit" disabled={totpCode.length !== 6} loading={loading} loadingLabel="Verificando…" className="flex-1">Verificar</Button></div>
      </form> : <form onSubmit={(event) => void submitCode(event)} className="mt-4 grid grid-cols-1 gap-3" noValidate>
        <Field label="Código do crachá" htmlFor="codigo-cracha"><div className="mt-1 flex min-w-0 gap-2">
          <input ref={codeInputRef} id="codigo-cracha" name="codigoCracha" required type="text" inputMode="numeric" autoComplete="off" maxLength={20} value={codigoCracha} onChange={(event) => setCodigoCracha(event.target.value)} onKeyDown={(event) => { advanceFromBadgeFieldOnEnter(event, passwordInputRef.current); }} className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-4 text-base text-foreground" />
          <BadgeBarcodeScanner label="Ler o código de barras do crachá" validate={isValidBadgeCode} onDetect={(value) => { setCodigoCracha(value); setError(""); passwordInputRef.current?.focus(); }} onManual={() => codeInputRef.current?.focus()} />
        </div></Field>
        <div>
          <label htmlFor="login-password" className="text-sm font-semibold text-foreground">Senha</label>
          <div className="mt-1 flex gap-2">
              <input ref={passwordInputRef} id="login-password" required type={senhaVisivel ? "text" : "password"} autoComplete="current-password" maxLength={256} value={senha} onChange={(event) => setSenha(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-4 text-base text-foreground" />
              <Button type="button" variant="secondary" onClick={() => setSenhaVisivel((visible) => !visible)} aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"} className="px-3">
              {senhaVisivel ? "Ocultar" : "Mostrar"}
              </Button>
          </div>
        </div>
        {error && <div aria-live="assertive" aria-atomic="true"><p role="alert" className="rounded-control bg-error-surface px-3 py-2 text-sm text-error">{error}</p></div>}
        <p className="text-xs text-text-secondary">A senha não substitui verificações adicionais configuradas para o seu perfil.</p>
        <Button type="submit" disabled={!codigoCracha.trim() || !senha} loading={loading} loadingLabel="Verificando…" className="min-h-12 w-full">Entrar com senha</Button>
      </form>}
      </div>
    </Card>
  </main>;
}
