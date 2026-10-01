"use client";

import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Portal = "admin" | "almoxarifado";
type LoginResult = { funcionario: { mustChangePassword: boolean } };
type FaceChallenge = { challengeId: string; nonce: string; challenge: string; expiresAt: string };

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden
    ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4.4 9.7 6.1a1.5 1.5 0 0 1 0 1.8 17 17 0 0 1-3.1 3.2M6.1 6.1A17 17 0 0 0 2.3 11a1.5 1.5 0 0 0 0 2C3.5 14.8 6.9 19 12 19c1.1 0 2.1-.2 3-.5" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.3 12S5.7 5 12 5s9.7 7 9.7 7-3.4 7-9.7 7-9.7-7-9.7-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export default function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const isAdmin = portal === "admin";
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [faceChallenge, setFaceChallenge] = useState<FaceChallenge | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function completeLogin(data: LoginResult) {
    const destination = isAdmin ? "/admin" : "/almoxarifado";
    router.replace(!isAdmin && data.funcionario.mustChangePassword ? `/alterar-senha?next=${destination}` : destination);
  }

  async function parseResponse(response: Response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir o login.");
    return data;
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!identificador || !senha) { setError("Preencha os dois campos."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal, identificador, senha }),
      });
      const data = await response.json();
      if (response.status === 202 && data.step === "totp") {
        setPreAuthToken(data.preAuthToken);
        setStep("totp");
        return;
      }
      if (response.status === 202 && data.step === "webauthn") {
        const credential = await startAuthentication({ optionsJSON: data.options });
        const verified = await fetch("/api/auth/login/webauthn/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: data.challengeId, credential }),
        });
        const verifiedData = await parseResponse(verified);
        if (verifiedData.step === "face") {
          setFaceChallenge(verifiedData);
          return;
        }
        completeLogin(verifiedData);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Credenciais inválidas.");
      completeLogin(data);
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
        body: JSON.stringify({ challengeId: faceChallenge.challengeId, nonce: faceChallenge.nonce, capture: canvas.toDataURL("image/jpeg", 0.85) }),
      });
      completeLogin(await parseResponse(response));
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
      completeLogin(await parseResponse(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar o código.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/login" className="text-sm font-semibold text-royal hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-royal">← Voltar para escolha</Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">{faceChallenge ? "Verificação facial" : step === "totp" ? "Verificação em duas etapas" : `Login ${isAdmin ? "Admin" : "Almoxarifado"}`}</h1>
      {faceChallenge ? <form onSubmit={(event) => void submitFace(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">A câmera ficará ativa apenas durante esta tentativa. {faceChallenge.challenge === "piscar" ? "Piscar" : faceChallenge.challenge === "virar_esquerda" ? "Virar levemente o rosto para a esquerda" : "Sorrir"} quando estiver enquadrado.</p>
        <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Prévia da câmera" /></div>
        <p className="text-xs text-slate-500">Expira em {new Date(faceChallenge.expiresAt).toLocaleTimeString("pt-BR")}. A decisão é feita no servidor.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={loading} onClick={cancelFace} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={loading} onClick={() => void enableCamera()} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Ativar câmera</button><button type="submit" disabled={loading} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : step === "totp" ? <form onSubmit={(event) => void submitTotp(event)} className="mt-7 space-y-5">
        <p className="text-sm text-slate-600">Digite o código de 6 dígitos do aplicativo autenticador do administrador.</p>
        <label htmlFor="totp-code" className="block text-sm font-semibold text-slate-800">Código de verificação<input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={loading} onClick={() => { setStep("credentials"); setPreAuthToken(""); setTotpCode(""); setError(""); }} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Voltar</button><button type="submit" disabled={loading || totpCode.length !== 6} className="min-h-11 flex-1 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Verificando…" : "Verificar"}</button></div>
      </form> : <form onSubmit={(event) => void submitCredentials(event)} className="mt-7 space-y-5" noValidate>
        <div><label htmlFor="identificador" className="text-sm font-semibold text-slate-800">{isAdmin ? "Usuário" : "Código do crachá"}</label><input id="identificador" name="identificador" required type="text" inputMode={isAdmin ? "text" : "numeric"} autoComplete="username" autoCapitalize="none" value={identificador} onChange={(event) => setIdentificador(isAdmin ? event.target.value : event.target.value.replace(/\D/g, ""))} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></div>
        <div><label htmlFor="senha" className="text-sm font-semibold text-slate-800">Senha</label><div className="relative"><input id="senha" name="senha" required type={showPassword ? "text" : "password"} autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 focus-visible:outline-2 focus-visible:outline-royal"><EyeIcon hidden={!showPassword} /></button></div></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-royal px-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400">{loading ? "Verificando…" : "Entrar"}</button>
      </form>}
    </section>
  </main>;
}