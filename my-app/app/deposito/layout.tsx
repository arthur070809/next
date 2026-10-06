import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import { PapelFuncionario } from "@/generated/prisma/client";

export default async function LegacyDepositLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/deposito");
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) forbidden();
  return children;
}