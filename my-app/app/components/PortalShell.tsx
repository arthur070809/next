"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import SessionHeartbeat from "./SessionHeartbeat";
import { Button } from "./ui";

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
  { href: "/minhas-requisicoes", label: "Minhas Requisições", icon: "▤" },
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
    <div className="min-h-dvh bg-background text-foreground" data-shell>
      <SessionHeartbeat />
      <aside
        className={`fixed left-0 top-0 z-30 flex h-dvh w-72 flex-col overflow-hidden border-r border-brand-pressed bg-brand px-5 py-5 text-white transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href={homeHref} className="inline-flex rounded-control bg-white p-2" aria-label="Marcon Metalúrgicos, início">
            <Image src="/marcon-logo.svg" width={159} height={31} alt="Marcon Metalúrgicos" priority />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 min-w-11 rounded-control border border-white/30 p-2 text-white hover:bg-white/10 lg:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <div className="mt-6 rounded-panel border border-white/20 bg-white/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">Operação</p>
          <p className="mt-2 text-sm font-semibold text-white">{roleLabel}</p>
          <p className="mt-1 truncate text-xs text-white/80">{userName}</p>
        </div>

        <nav
          aria-label={isAdmin ? "Navegação administrativa" : isOperator ? "Navegação do operador" : "Navegação do almoxarifado"}
          className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain"
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
                    ? "bg-white text-brand shadow-card"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
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
          className="fixed inset-0 z-20 bg-foreground/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="min-w-0 lg:pl-72">
        <header className="border-b border-border-subtle bg-surface px-4 sm:px-8">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(true)}
                className="shrink-0 px-3 lg:hidden"
                aria-label="Abrir menu"
                aria-expanded={open}
              >
                Menu
              </Button>
              <Link href={homeHref} className="inline-flex rounded-control bg-white p-1.5 lg:hidden" aria-label="Marcon Metalúrgicos, início">
                <Image src="/marcon-logo.svg" width={143} height={28} alt="Marcon Metalúrgicos" priority />
              </Link>
            </div>

            <div className="hidden text-sm font-medium text-text-secondary sm:block">
              {isAdmin ? "Painel de administração" : isOperator ? "Área do operador" : "Área do almoxarifado"}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary sm:inline-flex">
                {roleLabel}
              </span>
              <span className="max-w-32 truncate text-sm font-semibold text-foreground">{userName}</span>
              <Button
                disabled={loggingOut}
                onClick={() => void logout()}
                variant="secondary"
                className="min-h-11 shrink-0 px-3 hover:border-error hover:text-error"
                loading={loggingOut}
                loadingLabel="Saindo…"
              >
                Sair
              </Button>
            </div>
          </div>
        </header>

        {logoutError && (
          <p role="alert" className="mx-4 mt-3 rounded-control border border-error/30 bg-error-surface px-3 py-2 text-sm text-error sm:mx-8">
            {logoutError}
          </p>
        )}

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-surface px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-card lg:hidden">
        <div className={`grid ${isOperator ? "grid-cols-2" : "grid-cols-4"} gap-2`}>
          {menu.slice(0, 4).map((item) => {
            const isActive = item.href === homeHref ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 flex-col items-center justify-center rounded-control px-2 py-1.5 text-[11px] font-semibold ${
                  isActive ? "bg-brand text-white" : "text-text-secondary hover:bg-background"
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