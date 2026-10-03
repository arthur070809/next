import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, getRoleHomePath, requiresPasswordChange } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) {
    const destination = getRoleHomePath(funcionario.role);
    if (requiresPasswordChange(funcionario)) redirect(`/alterar-senha?next=${destination}`);
    redirect(destination);
  }
  return <LoginForm />;
}
