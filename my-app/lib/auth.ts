import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "marcon_session";

export async function getAuthenticatedSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) return null;

  const session = await prisma.sessao.findUnique({
    where: { token },
    include: { funcionario: true },
  });

  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await prisma.sessao.delete({ where: { id: session.id } });
    return null;
  }

  if (!session.funcionario.ativo) return null;

  return session;
}

export async function getAuthenticatedFuncionario() {
  const session = await getAuthenticatedSession();
  return session?.funcionario ?? null;
}

export async function requireAdmin() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return { funcionario: null, status: 401 as const };
  if (funcionario.role !== "admin") return { funcionario: null, status: 403 as const };
  return { funcionario, status: 200 as const };
}

export function requiresPasswordChange(funcionario: { role: string; mustChangePassword: boolean }) {
  return funcionario.role !== "admin" && funcionario.mustChangePassword;
}