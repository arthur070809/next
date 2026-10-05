import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import PortalShell from "../components/PortalShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) {
    if (process.env.NODE_ENV === "development") {
      console.info("[auth] acesso a /admin recusado: sessão ausente ou inválida.");
    }
    redirect("/login?callbackUrl=%2Fadmin");
  }
  if (funcionario.role !== "admin") {
    if (process.env.NODE_ENV === "development") {
      console.info(`[auth] acesso a /admin recusado: papel insuficiente (${funcionario.role}); esperado admin.`);
    }
    redirect("/login?callbackUrl=%2Fadmin");
  }
  return <PortalShell userName={funcionario.nome} role="admin">{children}</PortalShell>;
}