"use client";

import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";
import { FormEvent, useState } from "react";
import { Button, Card } from "../components/ui";

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

  return <main className="safe-area-inset flex min-h-dvh items-center justify-center bg-background py-8">
    <Card className="w-full max-w-lg p-5 sm:p-8">
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">Voltar ao login</Link>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-brand">Almoxarifado Marcon</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Parear aparelho aprovado</h1>
      {success ? <div role="status" className="mt-5 rounded-lg border border-success/30 bg-success-surface p-4 text-sm text-success"><p className="font-semibold">Aparelho pareado com sucesso.</p><p className="mt-1">Agora você pode entrar com crachá, senha e verificação do aparelho.</p></div> : <form onSubmit={(event) => void pairDevice(event)} className="mt-5 space-y-5">
        <label htmlFor="pairing-code" className="block text-sm font-semibold text-foreground">Código de pareamento<input id="pairing-code" required minLength={12} maxLength={32} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))} className="mt-2 block min-h-12 w-full rounded-control border border-border px-4 font-mono text-lg tracking-widest" /></label>
        <label className="flex items-start gap-3 rounded-control bg-background p-4 text-sm leading-6 text-foreground"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-5 shrink-0 accent-brand" /><span><strong>Consentimento de verificação local.</strong> Autorizo este aparelho a usar o bloqueio de tela do sistema operacional para verificar meu acesso. Os dados de desbloqueio permanecem no aparelho e não são enviados nem armazenados pelo Almoxarifado Marcon. Posso pedir a revogação do aparelho ao admin.</span></label>
        <p className="text-xs text-text-secondary">O código expira em 5 minutos. A confirmação acontece na janela segura do sistema do aparelho.</p>
        {error && <p role="alert" className="rounded-lg bg-error-surface p-3 text-sm text-error">{error}</p>}
        <Button type="submit" disabled={!consent || code.trim().length < 12} loading={busy} loadingLabel="Verificando aparelho…" className="w-full">Parear aparelho</Button>
      </form>}
    </Card>
  </main>;
}