"use client";

import { FormEvent, useEffect, useState } from "react";

type Funcionario = { id: number; nome: string; cracha: string; cargo: string; role: string; ativo: boolean; mustChangePassword: boolean };
type Pagination = { page: number; pageSize: number; total: number };
const emptyForm = { nome: "", cracha: "", senha: "", confirmarSenha: "" };

export default function AdminUsersClient() {
  const [users, setUsers] = useState<Funcionario[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0 });
  const [resetTarget, setResetTarget] = useState<Funcionario | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsers = async (page = pagination.page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pagination.pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (status !== "todos") params.set("status", status);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os usuários.");
      setUsers(data.funcionarios ?? []); setPagination(data.pagination);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadUsers(1); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    if (form.senha !== form.confirmarSenha) { setError("As senhas não coincidem."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: form.nome, cracha: form.cracha, senha: form.senha }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar o usuário.");
      setMessage("Usuário criado. A troca de senha será exigida no primeiro acesso."); setForm(emptyForm); await loadUsers(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro inesperado."); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (user: Funcionario) => {
    if (!window.confirm(`${user.ativo ? "Desativar" : "Reativar"} ${user.nome}?`)) return;
    setError("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-active", userId: user.id, ativo: !user.ativo }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Não foi possível alterar o status."); return; }
    setMessage(data.message); await loadUsers();
  };

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!resetTarget) return;
    setError("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset-password", userId: resetTarget.id, senha: resetPassword }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Não foi possível redefinir a senha."); return; }
    setMessage(data.message); setResetTarget(null); setResetPassword("");
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-7xl"><header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Administração</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Usuários</h1><p className="mt-1 text-slate-600">Gerencie acessos sem alterar o histórico de requisições.</p></header>{(error || message) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || message}</p>}<section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Cadastrar usuário</h2><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate><label className="text-sm font-semibold">Nome<input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="text-sm font-semibold">Código do crachá<input required pattern="[0-9]{4,10}" inputMode="numeric" value={form.cracha} onChange={(event) => setForm({ ...form, cracha: event.target.value.replace(/\D/g, "") })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="text-sm font-semibold">Senha inicial<input required minLength={12} type={showPassword ? "text" : "password"} value={form.senha} onChange={(event) => setForm({ ...form, senha: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="text-sm font-semibold">Confirmar senha<input required minLength={12} type={showPassword ? "text" : "password"} value={form.confirmarSenha} onChange={(event) => setForm({ ...form, confirmarSenha: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><div className="flex items-center gap-4 sm:col-span-2"><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-sm font-semibold text-royal focus-visible:outline-2 focus-visible:outline-royal">{showPassword ? "Ocultar senhas" : "Mostrar senhas"}</button><button disabled={saving} className="rounded-lg bg-royal px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Cadastrar usuário"}</button></div></form></section><section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end"><label className="flex-1 text-sm font-semibold">Buscar por nome ou crachá<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadUsers(1); } }} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><label className="text-sm font-semibold">Status<select value={status} onChange={(event) => { setStatus(event.target.value); void loadUsers(1); }} className="mt-2 rounded-lg border border-slate-300 bg-white p-3 font-normal"><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label><button type="button" onClick={() => void loadUsers(1)} className="rounded-lg border border-royal px-5 py-3 text-sm font-semibold text-royal">Buscar</button></div>{loading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando usuários...</p> : users.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Nenhum usuário encontrado.</p> : <div className="divide-y divide-slate-200">{users.map((user) => <div key={user.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{user.nome}</p><p className="mt-1 text-sm text-slate-500">Crachá {user.cracha} · {user.role}</p><p className={user.ativo ? "mt-1 text-sm text-emerald-700" : "mt-1 text-sm text-red-700"}>{user.ativo ? "Ativo" : "Inativo"}{user.mustChangePassword ? " · troca pendente" : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setResetTarget(user); setError(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Redefinir senha</button><button type="button" onClick={() => void toggleStatus(user)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">{user.ativo ? "Desativar" : "Reativar"}</button></div></div>)}</div>}<div className="mt-5 flex items-center justify-between text-sm text-slate-600"><span>{pagination.total} usuário(s)</span><div className="flex items-center gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1)} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {pagination.page} de {totalPages}</span><button type="button" disabled={pagination.page >= totalPages} onClick={() => void loadUsers(pagination.page + 1)} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Próxima</button></div></div></section></div>{resetTarget && <div role="dialog" aria-modal="true" aria-labelledby="reset-title" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-5"><form onSubmit={submitReset} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="reset-title" className="text-xl font-bold text-slate-950">Redefinir senha</h2><p className="mt-2 text-sm text-slate-600">Nova senha para {resetTarget.nome}. A troca será exigida no próximo acesso.</p><label className="mt-5 block text-sm font-semibold">Nova senha<input required minLength={12} autoFocus type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setResetTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancelar</button><button className="rounded-lg bg-royal px-4 py-2 font-semibold text-white">Redefinir senha</button></div></form></div>}</main>;
}