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
  { href: "/admin/dispositivos", label: "Aparelhos", icon: "▣" },
  { href: "/admin/biometria", label: "Biometria facial", icon: "◌" },
  { href: "/admin/seguranca", label: "Segurança", icon: "⌑" },
];

const warehouseMenu = [
  { href: "/almoxarifado", label: "Início", icon: adminMenu[0].icon },
  { href: "/almoxarifado/requisicoes", label: "Fila de requisições", icon: "▤" },
  { href: "/historico", label: "Histórico", icon: "◷" },
  { href: "/almoxarifado/estoque", label: "Estoque", icon: adminMenu[1].icon },
  { href: "/almoxarifado/deposito", label: "Depósito de sobras", icon: adminMenu[2].icon },
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
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside data-demo-sticky-sidebar className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-800 bg-slate-950 px-5 py-6 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <Link href={homeHref} className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Almoxarifado Marcon</Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded p-2 text-slate-300 focus-visible:outline-2 focus-visible:outline-white lg:hidden" aria-label="Fechar menu">×</button>
        </div>
        <nav aria-label={isAdmin ? "Navegação administrativa" : isOperator ? "Navegação do operador" : "Navegação do almoxarifado"} className="mt-10 space-y-1">
          {menu.map((item) => {
            const active = item.href === homeHref ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <span aria-hidden="true" className="w-5 text-center text-lg">{item.icon}</span>{item.label}
            </Link>;
          })}
        </nav>
      </aside>
      {open && <button type="button" className="fixed inset-0 z-20 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
      <div className="lg:pl-72">
        <header data-demo-sticky-header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-royal lg:hidden" aria-label="Abrir menu" aria-expanded={open}>Menu</button>
          <div className="hidden text-sm text-slate-500 sm:block">{isAdmin ? "Painel de administração" : isOperator ? "Área do operador" : "Área do almoxarifado"}</div>
          <div className="ml-auto flex items-center gap-4">
            <span className="max-w-40 truncate text-sm font-semibold text-slate-800">{userName}</span>
            <button type="button" disabled={loggingOut} onClick={() => void logout()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-royal disabled:cursor-wait disabled:opacity-60">{loggingOut ? "Saindo…" : "Sair"}</button>
          </div>
        </header>
        {logoutError && <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-8">{logoutError}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}