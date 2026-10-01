import { forbidden, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DevicesManager from "./DevicesManager";

export default async function TrustedDevicesPage() {
  const auth = await requireAdmin();
  if (!auth.funcionario) {
    if (auth.status === 401) redirect("/login/admin");
    forbidden();
  }
  const [devices, employees] = await Promise.all([
    prisma.trustedDevice.findMany({
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        nome: true,
        criadoEm: true,
        pareadoEm: true,
        ultimoAcessoEm: true,
        revogadoEm: true,
        credenciais: {
          where: { revogadoEm: null },
          select: {
            id: true,
            criadoEm: true,
            consentVersion: true,
            funcionario: { select: { id: true, nome: true, cracha: true } },
          },
        },
      },
    }),
    prisma.funcionario.findMany({ where: { role: "user", ativo: true }, select: { id: true, nome: true, cracha: true }, orderBy: { nome: "asc" } }),
  ]);
  const limit = Number.parseInt(process.env.TRUSTED_DEVICE_LIMIT ?? "7", 10) || 7;
  return <DevicesManager initialDevices={devices} employees={employees} limit={Math.max(1, Math.min(50, limit))} />;
}