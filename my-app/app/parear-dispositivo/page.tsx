"use client";

import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";
import { FormEvent, useState } from "react";

export default function PairTrustedDevicePage() {
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function pairDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !consent || code.trim().length < 12) return;
    setBusy(true);
    setError("");
    try {
      const optionsResponse = await fetch("/api/auth/device-pairing/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsData.error ?? "Código inválido ou expirado.");

      const credential = await startRegistration({ optionsJSON: optionsData.options });
      const completeResponse = await fetch("/api/auth/device-pairing/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingId: optionsData.pairingId, credential, consent: true }),
      });
      const completeData = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeData.error ?? "Não foi possível parear este aparelho.");
      setSuccess(true);
      setCode("");
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      setError(name === "NotAllowedError"
        ? "A verificação foi cancelada ou não está disponível neste aparelho. Tente novamente ou peça outro código ao admin."
        : cause instanceof Error ? cause.message : "Não foi possível concluir o pareamento.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
    <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <Link href="/login" className="text-sm font-semibold text-royal hover:underline">Voltar ao login</Link>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-royal">Almoxarifado Marcon</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">Parear aparelho aprovado</h1>
      {success ? <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Aparelho pareado com sucesso.</p><p className="mt-1">Agora você pode entrar com crachá, senha e verificação do aparelho.</p></div> : <form onSubmit={(event) => void pairDevice(event)} className="mt-5 space-y-5">
        <label htmlFor="pairing-code" className="block text-sm font-semibold text-slate-800">Código de pareamento<input id="pairing-code" required minLength={12} maxLength={32} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 px-4 font-mono text-lg tracking-widest outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#4169E1]" /><span><strong>Consentimento de verificação local.</strong> Autorizo este aparelho a usar a biometria ou o bloqueio de tela do sistema operacional para verificar meu acesso. O rosto, a impressão digital e as imagens não são enviados nem armazenados pelo Almoxarifado Marcon. Posso pedir a revogação do aparelho ao admin.</span></label>
        <p className="text-xs text-slate-500">O código expira em 5 minutos. A confirmação acontece na janela segura do sistema do aparelho.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !consent || code.trim().length < 12} className="min-h-11 w-full rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">{busy ? "Verificando aparelho…" : "Parear aparelho"}</button>
      </form>}
    </section>
  </main>;
}