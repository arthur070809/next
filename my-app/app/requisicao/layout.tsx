import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";

export default async function OperatorRequestLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/requisicao");
  if (funcionario.papel !== PapelFuncionario.OPERADOR) forbidden();
  return children;
}
