import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import PortalShell from "../components/PortalShell";

export default async function HistoricoLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/historico");

  return <PortalShell userName={funcionario.nome || funcionario.cracha} role="almoxarifado">{children}</PortalShell>;
}
