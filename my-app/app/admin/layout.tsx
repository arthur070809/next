import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import AdminShell from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin") redirect("/");
  return <AdminShell userName={funcionario.nome}>{children}</AdminShell>;
}