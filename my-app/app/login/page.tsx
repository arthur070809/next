import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, getRoleHomePath, requiresPasswordChange } from "@/lib/auth";
import { isFaceDemoPhotoModeEnabled } from "@/lib/facial/config";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ aviso?: string | string[] }>;
}) {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) {
    const destination = getRoleHomePath(funcionario.role);
    if (requiresPasswordChange(funcionario)) redirect(`/alterar-senha?next=${destination}`);
    redirect(destination);
  }
  const params = searchParams ? await searchParams : {};
  return <LoginForm
    sessionExpired={params.aviso === "inatividade"}
    demoPhotoMode={isFaceDemoPhotoModeEnabled()}
  />;
}
