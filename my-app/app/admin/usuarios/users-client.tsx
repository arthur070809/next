"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/app/components/industrial";
import { EmptyState, ErrorState, LoadingState } from "@/app/components/ui";

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
  const [usersError, setUsersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsers = async (page = pagination.page) => {
    setLoading(true);
    setUsersError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pagination.pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (status !== "todos") params.set("status", status);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os usuários.");
      setUsers(data.funcionarios ?? []); setPagination(data.pagination);
    } catch (cause) { setUsersError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let ativo = true;
    const params = new URLSearchParams({ page: "1", pageSize: String(pagination.pageSize) });
    fetch(`/api/admin/users?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os usuários.");
        return data;
      })
      .then((data) => {
        if (!ativo) return;
        setUsers(data.funcionarios ?? []);
        setPagination(data.pagination);
      })
      .catch((cause: unknown) => {
        if (ativo) setUsersError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => { ativo = false; };
  }, [pagination.pageSize]);

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
  return <main className="min-h-[calc(100dvh-4rem)] px-4 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-7xl"><PageHeader eyebrow="Administração" title="Usuários" description="Gerencie acessos sem alterar o histórico de requisições." />{(error || message) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-lg p-3 text-sm ${error ? "bg-error-surface text-error" : "bg-success-surface text-success"}`}>{error || message}</p>}<section className="mt-6 rounded-card bg-surface p-4 shadow-card sm:p-6"><h2 className="text-xl font-bold text-foreground">Cadastrar usuário</h2><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate><label className="text-sm font-semibold">Nome<input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Código do crachá<input required pattern="[0-9]{4,10}" inputMode="numeric" value={form.cracha} onChange={(event) => setForm({ ...form, cracha: event.target.value.replace(/\D/g, "") })} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Senha inicial<input required minLength={12} type={showPassword ? "text" : "password"} value={form.senha} onChange={(event) => setForm({ ...form, senha: event.target.value })} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Confirmar senha<input required minLength={12} type={showPassword ? "text" : "password"} value={form.confirmarSenha} onChange={(event) => setForm({ ...form, confirmarSenha: event.target.value })} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><div className="flex items-center gap-4 sm:col-span-2"><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-sm font-semibold text-brand focus-visible:outline-2 focus-visible:outline-brand">{showPassword ? "Ocultar senhas" : "Mostrar senhas"}</button><button disabled={saving} className="min-h-11 rounded-control bg-brand px-5 py-2.5 font-semibold text-surface transition-colors hover:bg-brand-hover active:bg-brand-pressed disabled:opacity-50">{saving ? "Salvando..." : "Cadastrar usuário"}</button></div></form></section><section className="mt-6 rounded-card bg-surface p-4 shadow-card sm:p-6"><div className="flex flex-col gap-3 border-b border-border-subtle pb-5 md:flex-row md:items-end"><label className="flex-1 text-sm font-semibold">Buscar por nome ou crachá<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadUsers(1); } }} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Status<select value={status} onChange={(event) => { setStatus(event.target.value); void loadUsers(1); }} className="mt-2 rounded-lg border border-border-subtle bg-surface p-3 font-normal"><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label><button type="button" onClick={() => void loadUsers(1)} className="min-h-11 rounded-control border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-priority-surface">Buscar</button></div>{usersError ? <ErrorState message={usersError} onRetry={() => void loadUsers()} /> : loading ? <LoadingState label="Carregando usuários…" rows={4} /> : users.length === 0 ? <EmptyState title="Nenhum usuário encontrado" message="Ajuste os filtros ou cadastre um funcionário." /> : <div className="divide-y divide-border-subtle">{users.map((user) => <div key={user.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-foreground">{user.nome}</p><p className="mt-1 text-sm text-text-secondary">Crachá {user.cracha} · {user.role}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge label={user.ativo ? "Ativo" : "Inativo"} tone={user.ativo ? "success" : "danger"} />{user.mustChangePassword && <StatusBadge label="Troca de senha pendente" tone="warning" />}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setResetTarget(user); setError(""); }} className="min-h-11 rounded-control border border-brand px-3 py-2.5 text-sm font-semibold text-brand hover:bg-priority-surface">Redefinir senha</button><button type="button" onClick={() => void toggleStatus(user)} className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold text-foreground">{user.ativo ? "Desativar" : "Reativar"}</button></div></div>)}</div>}<div className="mt-5 flex items-center justify-between text-sm text-text-secondary"><span>{pagination.total} usuário(s)</span><div className="flex items-center gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1)} className="min-h-11 rounded-control border border-brand px-3 py-2.5 font-semibold text-brand disabled:opacity-40">Anterior</button><span>Página {pagination.page} de {totalPages}</span><button type="button" disabled={pagination.page >= totalPages} onClick={() => void loadUsers(pagination.page + 1)} className="rounded border border-border-subtle px-3 py-2 disabled:opacity-40">Próxima</button></div></div></section></div>{resetTarget && <div role="dialog" aria-modal="true" aria-labelledby="reset-title" className="safe-area-inset fixed inset-0 z-40 flex items-end bg-foreground/60 sm:items-center sm:justify-center"><form onSubmit={submitReset} className="w-full max-w-md rounded-t-panel bg-surface p-6 shadow-overlay sm:rounded-panel"><h2 id="reset-title" className="text-xl font-bold text-foreground">Redefinir senha</h2><p className="mt-2 text-sm text-text-secondary">Nova senha para {resetTarget.nome}. A troca será exigida no próximo acesso.</p><label className="mt-5 block text-sm font-semibold">Nova senha<input required minLength={12} autoFocus type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 font-normal" /></label><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setResetTarget(null)} className="min-h-11 rounded-control border border-brand px-4 py-2.5 font-semibold text-brand hover:bg-priority-surface">Cancelar</button><button className="min-h-11 rounded-control bg-brand px-4 py-2.5 font-semibold text-surface transition-colors hover:bg-brand-hover active:bg-brand-pressed">Redefinir senha</button></div></form></div>}</main>;
}