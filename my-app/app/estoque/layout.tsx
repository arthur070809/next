import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import { PapelFuncionario } from "@/generated/prisma/client";
import SessionHeartbeat from "../components/SessionHeartbeat";

export default async function LegacyStockLayout({ children }: { children: ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/estoque");
  if (funcionario.papel !== PapelFuncionario.ADMIN && funcionario.papel !== PapelFuncionario.ALMOXARIFE) forbidden();
  return <>{children}<SessionHeartbeat /></>;
}