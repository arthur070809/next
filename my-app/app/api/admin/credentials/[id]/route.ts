import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getClientIpHash } from "@/lib/webauthn";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return NextResponse.json({ error: auth.status === 401 ? "Não autenticado." : "Acesso negado." }, { status: auth.status });
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const { id } = await params;
    const credential = await prisma.webAuthnCredential.findUnique({ where: { id }, select: { id: true, funcionarioId: true, trustedDeviceId: true, revogadoEm: true } });
    if (!credential) return NextResponse.json({ error: "Autenticador não encontrado." }, { status: 404 });

    await prisma.$transaction(async (transaction) => {
      await transaction.webAuthnCredential.delete({ where: { id } });
      await transaction.sessao.deleteMany({ where: { funcionarioId: credential.funcionarioId, trustedDeviceId: credential.trustedDeviceId } });
      await transaction.securityAuditEvent.create({
        data: {
          acao: "WEBAUTHN_CREDENTIAL_DELETED",
          resultado: "success",
          funcionarioId: credential.funcionarioId,
          atorId: auth.funcionario!.id,
          trustedDeviceId: credential.trustedDeviceId,
          ipHash: getClientIpHash(request),
        },
      });
    });
    return NextResponse.json({ message: "Autenticador removido; as sessões vinculadas foram encerradas." });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao remover credencial WebAuthn", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível remover o autenticador.", errorId }, { status: 500 });
  }
}