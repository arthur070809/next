"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Primeiro acesso</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Troque sua senha</h1><p className="mt-2 text-slate-600">Defina uma senha pessoal antes de continuar.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Senha atual<input required type="password" autoComplete="current-password" value={form.senhaAtual} onChange={(event) => setForm({ ...form, senhaAtual: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="block text-sm font-semibold">Nova senha<input required minLength={12} type="password" autoComplete="new-password" value={form.novaSenha} onChange={(event) => setForm({ ...form, novaSenha: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="block text-sm font-semibold">Confirmar nova senha<input required minLength={12} type="password" autoComplete="new-password" value={form.confirmarSenha} onChange={(event) => setForm({ ...form, confirmarSenha: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{success}</p>}<button disabled={saving} className="w-full rounded-lg bg-royal px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Alterar senha"}</button></form></section></main>;
}