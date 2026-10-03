import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";

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
  if (!session?.funcionario) return null;
  return {
    ...session.funcionario,
    role: papelParaRole(session.funcionario.papel),
  };
}

export async function requireAdmin() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return { funcionario: null, status: 401 as const };
  if (funcionario.papel !== PapelFuncionario.ADMIN)
    return { funcionario: null, status: 403 as const };
  return { funcionario, status: 200 as const };
}

export async function requireAlmoxarife() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return { funcionario: null, status: 401 as const };
  if (
    funcionario.papel !== PapelFuncionario.ALMOXARIFE &&
    funcionario.papel !== PapelFuncionario.ADMIN
  )
    return { funcionario: null, status: 403 as const };
  return { funcionario, status: 200 as const };
}

export function requiresPasswordChange(funcionario: {
  papel: PapelFuncionario;
  mustChangePassword: boolean;
}) {
  return (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.mustChangePassword
  );
}

/**
 * Mapeia o papel para o papel antigo "role" string — usado na API de login
 * para compatibilidade com o front-end até ele ser atualizado.
 */
export function papelParaRole(papel: PapelFuncionario): string {
  switch (papel) {
    case PapelFuncionario.ADMIN:
      return "admin";
    case PapelFuncionario.ALMOXARIFE:
      return "almoxarife";
    case PapelFuncionario.OPERADOR:
      return "operador";
    case PapelFuncionario.USUARIO:
    default:
      return "user";
  }
}

/**
 * Mapeia a string "role" antiga para o enum PapelFuncionario.
 * Usado para backward compat durante a transição.
 */
export function roleparaPapel(role: string): PapelFuncionario {
  switch (role.toLowerCase()) {
    case "admin":
      return PapelFuncionario.ADMIN;
    case "almoxarife":
      return PapelFuncionario.ALMOXARIFE;
    case "operador":
      return PapelFuncionario.OPERADOR;
    case "user":
    default:
      return PapelFuncionario.USUARIO;
  }
}