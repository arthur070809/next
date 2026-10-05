import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, getRoleHomePath } from "@/lib/auth";

export default async function LegacyAdminLoginPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) redirect(getRoleHomePath(funcionario.role));
  redirect("/login");
}
//