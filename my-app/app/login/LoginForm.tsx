"use client";

import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCameraStreamController, type CameraStreamController } from "@/lib/camera/camera-stream";
import { advanceBlinkState, faceEyeAspectRatio, initialBlinkState } from "@/lib/facial/blink";
import { faceCaptureQuality } from "@/lib/facial/config";
import { extractFaceEmbedding, loadBrowserHuman, type BrowserHuman } from "@/lib/facial/human-browser";
import { cameraErrorMessage } from "@/lib/qr/camera-utils";
import BuildIdentifier from "@/app/components/BuildIdentifier";

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

export default function LoginForm({
  sessionExpired = false,
  faceLoginEnabled = true,
}: {
  sessionExpired?: boolean;
  faceLoginEnabled?: boolean;
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
  const [identifyMode, setIdentifyMode] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceCameraRef = useRef<CameraStreamController | null>(null);
  const faceHumanRef = useRef<BrowserHuman | null>(null);

  function stopFaceCamera() {
    const camera = faceCameraRef.current;
    faceCameraRef.current = null;
    if (camera) camera.dispose();
    else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
  }

  useEffect(() => () => faceCameraRef.current?.dispose(), []);

  useEffect(() => {
    if (stage !== "face") return;
    let cancelled = false;
    void loadBrowserHuman(setFaceModelProgress).then(({ human }) => {
      if (!cancelled) {
        faceHumanRef.current = human;
        setFaceModelReady(true);
      }
    }).catch(() => {
      if (!cancelled) setError("Não foi possível carregar os modelos faciais locais. Tente novamente.");
    });
    return () => {
      cancelled = true;
      faceHumanRef.current = null;
      setFaceModelReady(false);
    };
  }, [stage]);

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
    setFaceChallenge({
      challengeId: data.challengeId,
      ...(data.loginToken ? { loginToken: data.loginToken } : {}),
      nonce: data.nonce,
      challenge: data.challenge,
      expiresAt: data.expiresAt,
    });
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
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoCracha, credential: "password", password: senha }),
      });
      await handleLoginResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível comunicar com o servidor.");
      (senha ? passwordInputRef.current : codeInputRef.current)?.focus();
    } finally {
      setLoading(false);
    }

  }

  async function startFaceLogin() {
    if (!faceLoginEnabled) return;
    const useIdentifyFlow = !codigoCracha.trim();
    setIdentifyMode(useIdentifyFlow);
    setError("");
    setLoading(true);
    try {
      if (useIdentifyFlow) {
        const response = await fetch("/api/auth/login/face/identify/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await readResponse(response);
        acceptFaceChallenge(data);
        return;
      }
      if (!codigoCracha.trim()) {
        setError("Informe o crachá para iniciar o reconhecimento facial.");
        codeInputRef.current?.focus();
        return;
      }
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoCracha, credential: "face" }),
      });
      await handleLoginResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o reconhecimento facial.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !faceChallenge || !videoRef.current || !faceHumanRef.current) return;
    setLoading(true);
    setError("");
    try {
      const video = videoRef.current;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 320 || video.videoHeight < 240) throw new Error("A câmera ainda não está pronta. Aguarde um instante.");
      setError(faceChallenge.challenge === "piscar"
        ? "Olhe para a câmera e pisque uma vez."
        : faceChallenge.challenge === "virar_esquerda"
          ? "Vire levemente o rosto à esquerda e volte a olhar para a câmera."
          : "Sorria levemente para a câmera.");
      const deadline = Date.now() + 8_000;
      let blinkState = initialBlinkState;
      let turnedLeft = false;
      let embedding: number[] | null = null;
      while (Date.now() < deadline && !embedding) {
        const result = await faceHumanRef.current.detect(video);
        const faces = result.face ?? [];
        if (faces.length === 1) {
          const face = faces[0];
          const rotation = face.rotation?.angle;
          const centered = face.boxRaw[0] + face.boxRaw[2] / 2 > faceCaptureQuality.centerXMin
            && face.boxRaw[0] + face.boxRaw[2] / 2 < faceCaptureQuality.centerXMax
            && face.boxRaw[1] + face.boxRaw[3] / 2 > faceCaptureQuality.centerYMin
            && face.boxRaw[1] + face.boxRaw[3] / 2 < faceCaptureQuality.centerYMax;
          const frontal = Boolean(rotation
            && Math.abs(rotation.yaw) <= faceCaptureQuality.yawLimitDegrees
            && Math.abs(rotation.pitch) <= faceCaptureQuality.pitchLimitDegrees
            && Math.abs(rotation.roll) <= faceCaptureQuality.rollLimitDegrees);
          if (faceChallenge.challenge === "piscar") {
            const mesh = (face.mesh ?? []).map((point) => [point[0] ?? Number.NaN, point[1] ?? Number.NaN]);
            const ear = faceEyeAspectRatio(mesh);
            if (ear !== null) blinkState = advanceBlinkState(blinkState, ear, Date.now());
          } else if (faceChallenge.challenge === "virar_esquerda") {
            if (rotation && rotation.yaw < -faceCaptureQuality.sideYawDegrees) turnedLeft = true;
          } else if (faceChallenge.challenge === "sorrir" && (face.emotion ?? []).some(
            (emotion) => emotion.emotion === "happy" && emotion.score >= 0.6,
          )) {
            turnedLeft = true;
          }
          const challengePassed = faceChallenge.challenge === "piscar"
            ? blinkState.completedAt !== null
            : turnedLeft && frontal;
          if (centered && frontal && challengePassed) embedding = extractFaceEmbedding(face);
        }
        if (!embedding) await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      if (!embedding) throw new Error("Não foi possível concluir a verificação. Melhore a iluminação e tente novamente.");
      const response = await fetch(identifyMode ? "/api/auth/login/face/identify" : "/api/auth/login/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: faceChallenge.challengeId,
          ...(faceChallenge.loginToken ? { loginToken: faceChallenge.loginToken } : {}),
          nonce: faceChallenge.nonce,
          embedding,
          challengeCompleted: true,
        }),
      });
      const data = await readResponse(response);
      if (!data.funcionario) throw new Error("Não foi possível verificar o acesso.");
      stopFaceCamera();
      completeLogin({ funcionario: data.funcionario });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar o acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function enableCamera() {
    setError("");
    try {
      const video = videoRef.current;
      if (!video) throw new DOMException("Vídeo indisponível.", "NotFoundError");
      stopFaceCamera();
      const camera = createCameraStreamController({ video });
      faceCameraRef.current = camera;
      await camera.start({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (cause) {
      faceCameraRef.current?.dispose();
      faceCameraRef.current = null;
      setError(cameraErrorMessage(cause));
    }
  }

  function cancelFace() {
    stopFaceCamera();
    setFaceChallenge(null);
    setIdentifyMode(false);
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

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 sm:px-5 sm:py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <Link href="/" className="text-sm font-semibold text-royal hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-royal">← Voltar</Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">{stage === "face" ? "Verificação facial" : stage === "totp" ? "Verificação em duas etapas" : "Entrar com código"}</h1>
      {sessionExpired && <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Sessão encerrada por inatividade</p>}
      {stage === "face" && faceChallenge ? <form onSubmit={(event) => void submitFace(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">A câmera ficará ativa apenas durante esta tentativa. {faceChallenge.challenge === "piscar" ? "Piscar" : faceChallenge.challenge === "virar_esquerda" ? "Virar levemente o rosto para a esquerda" : "Sorrir"} quando estiver enquadrado.</p>
        <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Prévia da câmera" /></div>
        <BuildIdentifier />
        <p className="text-xs text-slate-500">{faceModelProgress}. Expira em {new Date(faceChallenge.expiresAt).toLocaleTimeString("pt-BR")}. A decisão final é feita no servidor.</p>
        <div aria-live="assertive" aria-atomic="true" className="min-h-11">{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</div>
        <div className="flex flex-col gap-3 sm:flex-row"><button type="button" disabled={loading} onClick={cancelFace} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={loading || !faceModelReady} onClick={() => void enableCamera()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">{faceModelReady ? "Ativar câmera" : "Preparando modelos…"}</button><button type="submit" disabled={loading || !faceModelReady} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : stage === "totp" ? <form onSubmit={(event) => void submitTotp(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">Digite o código de 6 dígitos do aplicativo autenticador do administrador.</p>
        <label htmlFor="totp-code" className="block text-sm font-semibold text-slate-800">Código de verificação<input ref={totpInputRef} id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></label>
        <div aria-live="assertive" aria-atomic="true" className="min-h-11">{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</div>
        <div className="flex flex-col gap-3 sm:flex-row"><button type="button" disabled={loading} onClick={() => { setStage("code"); setPreAuthToken(""); setTotpCode(""); setError(""); }} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Voltar</button><button type="submit" disabled={loading || totpCode.length !== 6} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : <form onSubmit={(event) => void submitCode(event)} className="mt-7 space-y-5" noValidate>
        <div><label htmlFor="codigo-cracha" className="text-sm font-semibold text-slate-800">Código do crachá</label><input ref={codeInputRef} id="codigo-cracha" name="codigoCracha" required type="text" inputMode="numeric" autoComplete="off" maxLength={10} autoFocus value={codigoCracha} onChange={(event) => setCodigoCracha(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></div>
        <div>
          <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Senha</label>
          <div className="mt-2 flex gap-2">
            <input ref={passwordInputRef} id="login-password" required type={senhaVisivel ? "text" : "password"} autoComplete="current-password" maxLength={256} value={senha} onChange={(event) => setSenha(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" />
            <button type="button" onClick={() => setSenhaVisivel((visible) => !visible)} aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-royal">
              {senhaVisivel ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        <div aria-live="assertive" aria-atomic="true" className="min-h-11">{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</div>
        <p className="text-xs text-slate-500">A senha não substitui verificações adicionais configuradas para o seu perfil.</p>
        <button type="submit" disabled={loading || !codigoCracha.trim() || !senha} className="min-h-12 w-full rounded-lg bg-royal px-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400">{loading ? "Verificando…" : "Entrar com senha"}</button>
        {faceLoginEnabled && <button type="button" disabled={loading} onClick={() => void startFaceLogin()} className="min-h-11 w-full rounded-lg border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-royal disabled:cursor-wait disabled:opacity-50">
          {loading ? "Preparando câmera…" : "Entrar com reconhecimento facial"}
        </button>}
      </form>}
    </section>
  </main>;
}
