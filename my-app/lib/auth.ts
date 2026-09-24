import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "marcon_session";

export async function getAuthenticatedFuncionario() {
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

  return session.funcionario;
}