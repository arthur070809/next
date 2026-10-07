"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SessionHeartbeat from "../components/SessionHeartbeat";
import { Button, Card, Field } from "../components/ui";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ senhaAtual: "", novaSenha: "", confirmarSenha: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setSuccess("");
    if (form.novaSenha !== form.confirmarSenha) { setError("As senhas não coincidem."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível alterar a senha.");
      setSuccess(data.message); setTimeout(() => router.replace("/login"), 900);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro inesperado."); }
    finally { setSaving(false); }
  };

  return <><SessionHeartbeat /><main className="safe-area-inset flex min-h-dvh items-center justify-center bg-background py-8">
    <Card className="w-full max-w-lg p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Primeiro acesso</p>
      <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">Troque sua senha</h1>
      <p className="mt-2 text-text-secondary">Defina uma senha pessoal antes de continuar.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Senha atual" htmlFor="senha-atual">
          <input id="senha-atual" required type="password" autoComplete="current-password" value={form.senhaAtual} onChange={(event) => setForm({ ...form, senhaAtual: event.target.value })} className="min-h-11 w-full rounded-control border border-border px-3 py-2.5 font-normal" />
        </Field>
        <Field label="Nova senha" htmlFor="nova-senha">
          <input id="nova-senha" required minLength={12} type="password" autoComplete="new-password" value={form.novaSenha} onChange={(event) => setForm({ ...form, novaSenha: event.target.value })} className="min-h-11 w-full rounded-control border border-border px-3 py-2.5 font-normal" />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="confirmar-senha">
          <input id="confirmar-senha" required minLength={12} type="password" autoComplete="new-password" value={form.confirmarSenha} onChange={(event) => setForm({ ...form, confirmarSenha: event.target.value })} className="min-h-11 w-full rounded-control border border-border px-3 py-2.5 font-normal" />
        </Field>
        {error && <p role="alert" className="rounded-control bg-error-surface p-3 text-sm text-error">{error}</p>}
        {success && <p role="status" className="rounded-control bg-success-surface p-3 text-sm text-success">{success}</p>}
        <Button type="submit" loading={saving} loadingLabel="Salvando…" className="w-full">Alterar senha</Button>
      </form>
    </Card>
  </main></>;
}
