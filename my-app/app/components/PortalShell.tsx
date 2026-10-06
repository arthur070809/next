"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type PortalRole = "admin" | "almoxarifado" | "operador";

const adminMenu = [
  { href: "/admin", label: "Início", icon: "⌂" },
  { href: "/almoxarifado/requisicoes", label: "Fila de requisições", icon: "▤" },
  { href: "/historico", label: "Histórico", icon: "◷" },
  { href: "/admin/ressuprimento", label: "Ressuprimento", icon: "↗" },
  { href: "/admin/estoque", label: "Estoque", icon: "▦" },
  { href: "/admin/deposito", label: "Depósito de sobras", icon: "◇" },
  { href: "/admin/usuarios", label: "Usuários", icon: "◉" },
  { href: "/admin/biometria", label: "Biometria facial", icon: "◌" },
];

const warehouseMenu = [
  { href: "/almoxarifado", label: "Início", icon: adminMenu[0].icon },
  { href: "/almoxarifado/requisicoes", label: "Fila de requisições", icon: "▤" },
  { href: "/historico", label: "Histórico", icon: "◷" },
  { href: "/almoxarifado/estoque", label: "Estoque", icon: "▦" },
  { href: "/almoxarifado/deposito", label: "Depósito de sobras", icon: "◇" },
];

const operatorMenu = [
  { href: "/requisicao", label: "Nova requisição", icon: "＋" },
];

export default function PortalShell({
  children,
  userName,
  role = "admin",
}: {
  children: ReactNode;
  userName: string;
  role?: PortalRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin";
  const isOperator = role === "operador";
  const homeHref = isAdmin ? "/admin" : isOperator ? "/requisicao" : "/almoxarifado";
  const menu = isAdmin ? adminMenu : isOperator ? operatorMenu : warehouseMenu;
  const roleLabel = isAdmin ? "Admin" : isOperator ? "Operador" : "Almoxarifado";
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível encerrar a sessão.");
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Não foi possível sair. Verifique sua conexão e tente novamente.");
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" data-shell>
      <aside
        data-demo-sticky-sidebar
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-800 bg-slate-950 px-5 py-6 text-white transition-transform duration-200 ease-out lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href={homeHref} className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-900/30">
              M
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
              Marcon
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 focus-visible:outline-2 focus-visible:outline-white lg:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Operação</p>
          <p className="mt-2 text-sm font-semibold text-white">{roleLabel}</p>
          <p className="mt-1 text-xs text-slate-400">{userName}</p>
        </div>

        <nav
          aria-label={isAdmin ? "Navegação administrativa" : isOperator ? "Navegação do operador" : "Navegação do almoxarifado"}
          className="mt-8 space-y-1"
        >
          {menu.map((item) => {
            const active = item.href === homeHref ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center text-lg">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-slate-950/55 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="lg:pl-72">
        <header data-demo-sticky-header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={open}
            >
              Menu
            </button>

            <div className="hidden text-sm font-medium text-slate-500 sm:block">
              {isAdmin ? "Painel de administração" : isOperator ? "Área do operador" : "Área do almoxarifado"}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 sm:inline-flex">
                {roleLabel}
              </span>
              <span className="max-w-32 truncate text-sm font-semibold text-slate-800">{userName}</span>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void logout()}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
              >
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            </div>
          </div>
        </header>

        {logoutError && (
          <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-8">
            {logoutError}
          </p>
        )}

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {menu.slice(0, 4).map((item) => {
            const isActive = item.href === homeHref ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[10px] font-semibold ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                <span aria-hidden="true" className="mb-1 text-lg">
                  {item.icon}
                </span>
                {item.label.replace("Fila de requisições", "Requisições").split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}