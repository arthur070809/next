import { forbidden, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TotpManager from "./TotpManager";

export default async function AdminSecurityPage() {
  const auth = await requireAdmin();
  if (!auth.funcionario) {
    if (auth.status === 401) redirect("/login/admin");
    forbidden();
  }
  const credential = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id }, select: { enabledAt: true } });
  return <main className="mx-auto max-w-6xl p-4 sm:p-6"><header className="border-b border-slate-200 pb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">Administração</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Segurança da conta</h1><p className="mt-1 text-sm text-slate-600">Configure fatores adicionais de autenticação para a conta administrativa.</p></header><TotpManager initiallyEnabled={Boolean(credential?.enabledAt)} /></main>;
}