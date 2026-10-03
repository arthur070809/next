import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getClientIpHash, hashSecret, pairingCodeTtlMs, emergencyGrantTtlMs } from "@/lib/webauthn";

type RouteContext = { params: Promise<{ id: string }> };
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return fail(auth.status === 401 ? "Não autenticado." : "Acesso negado.", auth.status);
    if (!isSameOrigin(request)) return fail("Origem inválida.", 403);
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail("Envie uma ação válida.", 400);
    }
    const action = body.action;

    if (action === "revoke") {
      const now = new Date();
      const updated = await prisma.$transaction(async (transaction) => {
        const revoked = await transaction.trustedDevice.updateMany({ where: { id, revogadoEm: null }, data: { revogadoEm: now } });
        if (revoked.count !== 1) return false;
        await transaction.webAuthnCredential.updateMany({ where: { trustedDeviceId: id, revogadoEm: null }, data: { revogadoEm: now } });
        await transaction.sessao.deleteMany({ where: { trustedDeviceId: id } });
        await transaction.devicePairing.updateMany({ where: { trustedDeviceId: id, usadoEm: null }, data: { expiraEm: now } });
        await transaction.securityAuditEvent.create({
          data: { acao: "DEVICE_REVOKED", resultado: "success", atorId: auth.funcionario.id, trustedDeviceId: id, ipHash: getClientIpHash(request) },
        });
        return true;
      });
      return updated ? NextResponse.json({ message: "Dispositivo revogado." }) : fail("Dispositivo não encontrado ou já revogado.", 404);
    }

    const device = await prisma.trustedDevice.findFirst({ where: { id, revogadoEm: null }, select: { id: true } });
    if (!device) return fail("Dispositivo não encontrado ou revogado.", 404);

    if (action === "pair") {
      const funcionarioId = Number(body.funcionarioId);
      if (!Number.isSafeInteger(funcionarioId) || funcionarioId < 1) return fail("Selecione um funcionário válido.", 400);
      const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, papel: "ALMOXARIFE", ativo: true }, select: { id: true } });
      if (!funcionario) return fail("Funcionário não encontrado ou inativo.", 404);
      const code = randomBytes(9).toString("base64url").toUpperCase();
      const expiresAt = new Date(Date.now() + pairingCodeTtlMs);
      await prisma.$transaction(async (transaction) => {
        await transaction.devicePairing.create({
          data: { codeHash: hashSecret(code), trustedDeviceId: id, funcionarioId, criadoPorId: auth.funcionario.id, expiraEm: expiresAt },
        });
        await transaction.securityAuditEvent.create({
          data: { acao: "DEVICE_PAIRING_CREATED", resultado: "success", funcionarioId, atorId: auth.funcionario.id, trustedDeviceId: id, ipHash: getClientIpHash(request) },
        });
      });
      return NextResponse.json({ pairingCode: code, expiresAt }, { status: 201 });
    }

    if (action === "emergency-access") {
      const funcionarioId = Number(body.funcionarioId);
      const justification = typeof body.justification === "string" ? body.justification.trim() : "";
      if (!Number.isSafeInteger(funcionarioId) || funcionarioId < 1 || justification.length < 10 || justification.length > 200) {
        return fail("Selecione um funcionário e informe uma justificativa de 10 a 200 caracteres.", 400);
      }
      const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, papel: "ALMOXARIFE", ativo: true }, select: { id: true } });
      if (!funcionario) return fail("Funcionário não encontrado ou inativo.", 404);
      const expiresAt = new Date(Date.now() + emergencyGrantTtlMs);
      const grant = await prisma.$transaction(async (transaction) => {
        const created = await transaction.emergencyAccessGrant.create({
          data: { funcionarioId, trustedDeviceId: id, criadoPorId: auth.funcionario.id, justificativa: justification, expiraEm: expiresAt },
        });
        await transaction.securityAuditEvent.create({
          data: { acao: "EMERGENCY_ACCESS_GRANTED", resultado: "emergency", funcionarioId, atorId: auth.funcionario.id, trustedDeviceId: id, ipHash: getClientIpHash(request) },
        });
        return created;
      });
      return NextResponse.json({ grantId: grant.id, expiresAt }, { status: 201 });
    }

    return fail("Ação administrativa inválida.", 400);
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao administrar dispositivo confiável", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível administrar o dispositivo.", errorId }, { status: 500 });
  }
}