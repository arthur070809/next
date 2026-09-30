import { forbidden, redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import PortalShell from "../components/PortalShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin") forbidden();
  return <PortalShell userName={funcionario.nome} role="admin">{children}</PortalShell>;
}