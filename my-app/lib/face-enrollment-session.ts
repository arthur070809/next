import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSecret, hashSecret } from "@/lib/webauthn";

export const faceEnrollmentSessionTtlMs = 10 * 60 * 1000;
export const faceEnrollmentSessionMaxMs = 15 * 60 * 1000;

export async function createFaceEnrollmentSession(adminId: number, funcionarioId: number, now = new Date()) {
  const token = createSecret();
  const tetoEm = new Date(now.getTime() + faceEnrollmentSessionMaxMs);
  const session = await prisma.faceEnrollmentSession.create({
    data: {
      id: randomUUID(), tokenHash: hashSecret(token), adminId, funcionarioId,
      criadoEm: now, ultimaAtividade: now,
      expiraEm: new Date(now.getTime() + faceEnrollmentSessionTtlMs), tetoEm,
    },
    select: { id: true, expiraEm: true },
  });
  return { id: session.id, token, expiraEm: session.expiraEm };
}

export async function findFaceEnrollmentSession(id: string, token: string, adminId: number, funcionarioId: number) {
  const session = await prisma.faceEnrollmentSession.findUnique({ where: { id } });
  const now = new Date();
  if (!session || session.tokenHash !== hashSecret(token) || session.adminId !== adminId || session.funcionarioId !== funcionarioId || session.usadoEm || session.expiraEm <= now) return null;
  return session;
}

export async function renewFaceEnrollmentSession(id: string, token: string, adminId: number, funcionarioId: number, now = new Date()) {
  const session = await findFaceEnrollmentSession(id, token, adminId, funcionarioId);
  if (!session) return null;
  const expiraEm = new Date(Math.min(now.getTime() + faceEnrollmentSessionTtlMs, session.tetoEm.getTime()));
  const updated = await prisma.faceEnrollmentSession.updateMany({
    where: { id, tokenHash: hashSecret(token), adminId, funcionarioId, usadoEm: null, expiraEm: { gt: now } },
    data: { ultimaAtividade: now, expiraEm },
  });
  return updated.count === 1 ? expiraEm : null;
}
