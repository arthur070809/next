import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import PortalShell from "../components/PortalShell";

export default async function MyRequestsLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login?callbackUrl=%2Fminhas-requisicoes");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=%2Fminhas-requisicoes");
  if (funcionario.papel !== PapelFuncionario.OPERADOR) forbidden();
  return <PortalShell userName={funcionario.nome || funcionario.cracha} role="operador">{children}</PortalShell>;
}
