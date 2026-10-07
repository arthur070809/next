import { forbidden, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TotpManager from "./TotpManager";
import { PageHeader } from "@/app/components/industrial";

export default async function AdminSecurityPage() {
  const auth = await requireAdmin();
  if (!auth.funcionario) {
    if (auth.status === 401) redirect("/login/admin");
    forbidden();
  }
  const credential = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id }, select: { enabledAt: true } });
  return <main className="mx-auto max-w-6xl p-4 sm:p-6"><PageHeader eyebrow="Administração" title="Segurança da conta" description="Configure fatores adicionais de autenticação para a conta administrativa." /><TotpManager initiallyEnabled={Boolean(credential?.enabledAt)} /></main>;
}