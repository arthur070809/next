import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, requiresPasswordChange } from "@/lib/auth";
import LoginForm from "../LoginForm";

export default async function AdminLoginPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) {
    if (funcionario.role === "admin") redirect("/admin");
    if (requiresPasswordChange(funcionario)) redirect("/alterar-senha?next=/almoxarifado");
    redirect("/almoxarifado");
  }
  return <LoginForm portal="admin" />;
}