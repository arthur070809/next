import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import PortalShell from "../components/PortalShell";
import { PapelFuncionario } from "@/generated/prisma/client";

export default async function AlmoxarifadoLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/almoxarifado");
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) forbidden();

  return <PortalShell
    userName={funcionario.nome || funcionario.cracha}
    role={funcionario.papel === PapelFuncionario.ADMIN ? "admin" : "almoxarifado"}
  >
    {children}
  </PortalShell>;
}