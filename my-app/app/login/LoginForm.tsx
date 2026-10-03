"use client";

import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function LoginForm() {
  const router = useRouter();
  const [codigoCracha, setCodigoCracha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("code");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [faceChallenge, setFaceChallenge] = useState<FaceChallenge | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoCracha }),
      });
      await handleLoginResponse(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível comunicar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !faceChallenge || !videoRef.current) return;
    setLoading(true);
    setError("");
    try {
      const video = videoRef.current;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 320 || video.videoHeight < 240) throw new Error("A câmera ainda não está pronta. Aguarde um instante.");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const response = await fetch("/api/auth/login/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: faceChallenge.challengeId,
          ...(faceChallenge.loginToken ? { loginToken: faceChallenge.loginToken } : {}),
          nonce: faceChallenge.nonce,
          capture: canvas.toDataURL("image/jpeg", 0.85),
        }),
      });
      const data = await readResponse(response);
      if (!data.funcionario) throw new Error("Não foi possível verificar o acesso.");
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
    } catch {
      setError("Não foi possível acessar a câmera. Verifique a permissão do navegador e tente novamente.");
    }
  }

  function cancelFace() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setFaceChallenge(null);
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
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/" className="text-sm font-semibold text-royal hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-royal">← Voltar</Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">{stage === "face" ? "Verificação facial" : stage === "totp" ? "Verificação em duas etapas" : "Entrar com código"}</h1>
      {stage === "face" && faceChallenge ? <form onSubmit={(event) => void submitFace(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">A câmera ficará ativa apenas durante esta tentativa. {faceChallenge.challenge === "piscar" ? "Piscar" : faceChallenge.challenge === "virar_esquerda" ? "Virar levemente o rosto para a esquerda" : "Sorrir"} quando estiver enquadrado.</p>
        <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Prévia da câmera" /></div>
        <p className="text-xs text-slate-500">Expira em {new Date(faceChallenge.expiresAt).toLocaleTimeString("pt-BR")}. A decisão é feita no servidor.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={loading} onClick={cancelFace} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={loading} onClick={() => void enableCamera()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Ativar câmera</button><button type="submit" disabled={loading} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : stage === "totp" ? <form onSubmit={(event) => void submitTotp(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">Digite o código de 6 dígitos do aplicativo autenticador do administrador.</p>
        <label htmlFor="totp-code" className="block text-sm font-semibold text-slate-800">Código de verificação<input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={loading} onClick={() => { setStage("code"); setPreAuthToken(""); setTotpCode(""); setError(""); }} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Voltar</button><button type="submit" disabled={loading || totpCode.length !== 6} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : <form onSubmit={(event) => void submitCode(event)} className="mt-7 space-y-5" noValidate>
        <div><label htmlFor="codigo-cracha" className="text-sm font-semibold text-slate-800">Código do crachá</label><input id="codigo-cracha" name="codigoCracha" required type="text" inputMode="numeric" autoComplete="username" autoCapitalize="characters" value={codigoCracha} onChange={(event) => setCodigoCracha(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-royal px-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400">{loading ? "Verificando…" : "Continuar"}</button>
      </form>}
    </section>
  </main>;
}
