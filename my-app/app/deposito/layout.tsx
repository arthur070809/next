import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";

export default async function LegacyDepositLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/almoxarifado/deposito");
  if (funcionario.role !== "admin" && funcionario.role !== "user") forbidden();
  return children;
}