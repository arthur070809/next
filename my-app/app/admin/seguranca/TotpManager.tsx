"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useState } from "react";
import { StatusBadge } from "@/app/components/industrial";

export default function TotpManager({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function startSetup() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível iniciar a configuração.");
      const qrData = await QRCode.toDataURL(data.otpauthUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" });
      setSecret(data.secret as string);
      setQr(qrData);
      setMessage("Escaneie o QR no autenticador e confirme com o código atual.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  async function enableTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/totp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Código inválido.");
      setEnabled(true);
      setSecret("");
      setQr("");
      setCode("");
      setMessage("TOTP ativado. Os próximos logins admin solicitarão o código do autenticador.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ativar TOTP.");
    } finally {
      setBusy(false);
    }
  }

  async function disableTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/totp", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível desativar TOTP.");
      setEnabled(false);
      setCode("");
      setMessage("TOTP desativado. Recomendamos ativá-lo para a conta admin.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desativar TOTP.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-6 max-w-3xl rounded-card bg-surface p-5 shadow-card sm:p-6">
    <h2 className="text-lg font-semibold text-foreground">Verificação em duas etapas do admin</h2>
    <p className="mt-1 text-sm text-text-secondary">Use um autenticador TOTP. O segredo fica cifrado no banco com AES-256-GCM.</p>
    <div className="mt-4"><StatusBadge label={`Estado: ${enabled ? "Ativo" : "Desativado"}`} tone={enabled ? "success" : "warning"} /></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-error-surface p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-lg bg-success-surface p-3 text-sm text-success">{message}</p>}
    {!enabled && !secret && <button type="button" disabled={busy} onClick={() => void startSetup()} className="mt-4 min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors hover:bg-brand-hover active:bg-brand-pressed disabled:cursor-wait disabled:opacity-50">{busy ? "Preparando…" : "Configurar autenticador"}</button>}
    {!enabled && secret && <form onSubmit={(event) => void enableTotp(event)} className="mt-5 space-y-4">
      <Image src={qr} alt="QR code para configurar TOTP no autenticador" width={240} height={240} className="rounded-control bg-surface p-2 shadow-card" unoptimized />
      <p className="text-sm text-foreground">Chave para configuração manual: <code className="break-all rounded bg-background px-2 py-1">{secret}</code></p>
      <label htmlFor="totp-setup-code" className="block text-sm font-medium text-foreground">Código de 6 dígitos<input id="totp-setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mt-1 block min-h-11 w-full rounded-lg border border-border-subtle px-3 sm:max-w-xs" /></label>
      <button type="submit" disabled={busy || code.length !== 6} className="min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors hover:bg-brand-hover active:bg-brand-pressed disabled:cursor-wait disabled:opacity-50">{busy ? "Validando…" : "Ativar TOTP"}</button>
    </form>}
    {enabled && <form onSubmit={(event) => void disableTotp(event)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label htmlFor="totp-disable-code" className="block text-sm font-medium text-foreground">Código atual<input id="totp-disable-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mt-1 block min-h-11 w-full rounded-lg border border-border-subtle px-3 sm:w-56" /></label>
      <button type="submit" disabled={busy || code.length !== 6} className="min-h-11 rounded-control border border-error/30 px-4 text-sm font-semibold text-error hover:bg-error-surface disabled:cursor-wait disabled:opacity-50">{busy ? "Validando…" : "Desativar TOTP"}</button>
    </form>}
  </section>;
}