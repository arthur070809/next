import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";
import {
  SESSION_POLICIES,
  SESSION_SIGNAL_WRITE_INTERVAL_MS,
  sessionProfileForRole,
  validateSessionLifecycle,
} from "@/lib/session-policy";

export const sessionCookieName = "marcon_session";

function isMissingSessionLifecycleSchema(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "P2021" || error.code === "P2022";
}

function logMissingSessionLifecycleSchema(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : "unknown";
  console.error("[auth] Sessão indisponível: aplique a migration add_session_lifecycle.", { code });
}

export async function getAuthenticatedSession(options: { now?: Date; touch?: boolean } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) return null;

  const now = options.now ?? new Date();
  let session;
  try {
    session = await prisma.sessao.findUnique({
      where: { token },
      include: { funcionario: true, trustedDevice: true },
    });
  } catch (error) {
    if (isMissingSessionLifecycleSchema(error)) {
      logMissingSessionLifecycleSchema(error);
      return null;
    }
    throw error;
  }

  if (!session) return null;

  if (session.trustedDeviceId && (!session.trustedDevice || session.trustedDevice.revogadoEm)) {
    await prisma.sessao.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (!session.funcionario.ativo) return null;

  const profile = sessionProfileForRole(session.funcionario.papel);
  const validation = validateSessionLifecycle(session, profile, now);
  if (!validation.valid) return null;

  const shouldWriteSignal = options.touch !== false && (
    session.ultimoSinalEm.getTime() <= now.getTime() - SESSION_SIGNAL_WRITE_INTERVAL_MS ||
    session.saidaEm !== null
  );
  if (shouldWriteSignal) {
    const policy = SESSION_POLICIES[profile];
    const expiresAt = profile === "operador"
      ? new Date(now.getTime() + policy.idleTimeoutMs)
      : session.expiresAt;
    let result;
    try {
      result = await prisma.sessao.updateMany({
        where: {
          id: session.id,
          token,
          expiresAt: { gt: now },
          ultimoSinalEm: session.ultimoSinalEm,
          saidaEm: session.saidaEm,
          revogadaEm: null,
        },
        data: {
          ultimoSinalEm: now,
          saidaEm: null,
          ...(profile === "operador" ? { expiresAt } : {}),
        },
      });
    } catch (error) {
      if (isMissingSessionLifecycleSchema(error)) {
        logMissingSessionLifecycleSchema(error);
        return null;
      }
      throw error;
    }
    if (result.count !== 1) {
      try {
        const latest = await prisma.sessao.findUnique({
          where: { token },
          include: { funcionario: true, trustedDevice: true },
        });
        if (
          !latest ||
          !latest.funcionario.ativo ||
          (latest.trustedDeviceId && (!latest.trustedDevice || latest.trustedDevice.revogadoEm)) ||
          !validateSessionLifecycle(latest, profile, now).valid
        ) {
          return null;
        }
        session = latest;
      } catch (error) {
        if (isMissingSessionLifecycleSchema(error)) {
          logMissingSessionLifecycleSchema(error);
          return null;
        }
        throw error;
      }
      return session;
    }
    session.ultimoSinalEm = now;
    session.saidaEm = null;
    session.expiresAt = expiresAt;
  }

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

export function getRoleHomePath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "operador") return "/requisicao";
  return "/almoxarifado";
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