import { prisma } from "@/lib/prisma";

export type SecurityAuditInput = {
  action: string;
  result: "success" | "failure" | "denied" | "emergency";
  userId?: number;
  actorId?: number;
  deviceId?: string;
  ipHash?: string;
  detail?: string;
};

export async function recordSecurityEvent(event: SecurityAuditInput) {
  await prisma.securityAuditEvent.create({
    data: {
      acao: event.action.slice(0, 50),
      resultado: event.result,
      funcionarioId: event.userId ?? null,
      atorId: event.actorId ?? null,
      trustedDeviceId: event.deviceId ?? null,
      ipHash: event.ipHash ?? null,
      detalhe: event.detail?.slice(0, 200) ?? null,
    },
  });
}