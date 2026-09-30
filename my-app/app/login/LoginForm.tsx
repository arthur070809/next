"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Portal = "admin" | "almoxarifado";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4.4 9.7 6.1a1.5 1.5 0 0 1 0 1.8 17 17 0 0 1-3.1 3.2M6.1 6.1A17 17 0 0 0 2.3 11a1.5 1.5 0 0 0 0 2C3.5 14.8 6.9 19 12 19c1.1 0 2.1-.2 3-.5" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.3 12S5.7 5 12 5s9.7 7 9.7 7-3.4 7-9.7 7-9.7-7-9.7-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export default function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const isAdmin = portal === "admin";
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (!identificador || !senha) { setError("Preencha os dois campos."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portal, identificador, senha }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Credenciais inválidas."); return; }
      const destination = isAdmin ? "/admin" : "/almoxarifado";
      router.push(!isAdmin && data.funcionario.mustChangePassword ? `/alterar-senha?next=${destination}` : destination);
    } catch { setError("Não foi possível comunicar com o servidor."); }
    finally { setLoading(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><Link href="/login" className="text-sm font-semibold text-royal hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-royal">← Voltar para escolha</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Login {isAdmin ? "Admin" : "Almoxarifado"}</h1><form onSubmit={submit} className="mt-7 space-y-5" noValidate><div><label htmlFor="identificador" className="text-sm font-semibold text-slate-800">{isAdmin ? "Usuário" : "Código do crachá"}</label><input id="identificador" name="identificador" required type="text" inputMode={isAdmin ? "text" : "numeric"} autoComplete="username" autoCapitalize="none" value={identificador} onChange={(event) => setIdentificador(isAdmin ? event.target.value : event.target.value.replace(/\D/g, ""))} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></div><div><label htmlFor="senha" className="text-sm font-semibold text-slate-800">Senha</label><div className="relative"><input id="senha" name="senha" required type={showPassword ? "text" : "password"} autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 focus-visible:outline-2 focus-visible:outline-royal"><EyeIcon hidden={!showPassword} /></button></div></div>{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-royal px-5 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button></form></section></main>;
}