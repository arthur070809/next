import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import PortalShell from "../components/PortalShell";

export default async function AlmoxarifadoLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/almoxarifado");
  if (funcionario.role === "admin") redirect("/admin");
  if (funcionario.role !== "user") forbidden();

  return <PortalShell userName={funcionario.nome || funcionario.cracha} role="almoxarifado">{children}</PortalShell>;
}