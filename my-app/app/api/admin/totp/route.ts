import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecuritySecret, encryptSecuritySecret } from "@/lib/security-crypto";
import { isSameOrigin } from "@/lib/security";
import { createTotpSecret, verifyTotp } from "@/lib/totp";
import { getClientIpHash } from "@/lib/webauthn";

function denied(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado." }, { status });
}

async function getAdmin(request?: Request) {
  const auth = await requireAdmin();
  if (!auth.funcionario) return { response: denied(auth.status), funcionario: null };
  if (request && !isSameOrigin(request)) return { response: NextResponse.json({ error: "Origem inválida." }, { status: 403 }), funcionario: null };
  return { response: null, funcionario: auth.funcionario };
}

export async function GET() {
  try {
    const auth = await getAdmin();
    if (auth.response || !auth.funcionario) return auth.response;
    const credential = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id }, select: { enabledAt: true } });
    return NextResponse.json({ enabled: Boolean(credential?.enabledAt) });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao consultar estado TOTP", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível consultar a segurança da conta.", errorId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAdmin(request);
    if (auth.response || !auth.funcionario) return auth.response;
    const existing = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id } });
    if (existing?.enabledAt) return NextResponse.json({ error: "A verificação em duas etapas já está ativa." }, { status: 409 });

    const generated = createTotpSecret(auth.funcionario.login ?? auth.funcionario.cracha);
    const encrypted = encryptSecuritySecret(generated.secret);
    await prisma.adminTotpCredential.upsert({
      where: { funcionarioId: auth.funcionario.id },
      create: { funcionarioId: auth.funcionario.id, secretCiphertext: encrypted.ciphertext, secretIv: encrypted.iv, secretTag: encrypted.tag },
      update: { secretCiphertext: encrypted.ciphertext, secretIv: encrypted.iv, secretTag: encrypted.tag, enabledAt: null, lastVerifiedStep: BigInt(0) },
    });
    await prisma.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_SETUP_STARTED", resultado: "success", atorId: auth.funcionario.id, ipHash: getClientIpHash(request) } });
    return NextResponse.json({ secret: generated.secret, otpauthUrl: generated.uri });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao iniciar configuração TOTP", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível iniciar a configuração TOTP.", errorId }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAdmin(request);
    if (auth.response || !auth.funcionario) return auth.response;
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const credential = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id } });
    if (!credential || credential.enabledAt) return NextResponse.json({ error: "Inicie primeiro a configuração da verificação em duas etapas." }, { status: 400 });
    const secret = decryptSecuritySecret(credential.secretCiphertext, credential.secretIv, credential.secretTag);
    const step = verifyTotp(secret, code);
    if (step === null) return NextResponse.json({ error: "Código inválido. Confira o autenticador e tente novamente." }, { status: 400 });
    const enabledAt = new Date();
    const enabled = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminTotpCredential.updateMany({ where: { id: credential.id, enabledAt: null, lastVerifiedStep: credential.lastVerifiedStep }, data: { enabledAt, lastVerifiedStep: BigInt(step) } });
      if (updated.count !== 1) return false;
      await transaction.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_ENABLED", resultado: "success", atorId: auth.funcionario!.id, ipHash: getClientIpHash(request) } });
      return true;
    });
    if (!enabled) return NextResponse.json({ error: "A configuração mudou. Atualize e tente novamente." }, { status: 409 });
    return NextResponse.json({ message: "Verificação em duas etapas ativada." });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao ativar TOTP", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível ativar a verificação em duas etapas.", errorId }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAdmin(request);
    if (auth.response || !auth.funcionario) return auth.response;
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const credential = await prisma.adminTotpCredential.findUnique({ where: { funcionarioId: auth.funcionario.id } });
    if (!credential?.enabledAt) return NextResponse.json({ error: "A verificação em duas etapas já está desativada." }, { status: 400 });
    const secret = decryptSecuritySecret(credential.secretCiphertext, credential.secretIv, credential.secretTag);
    const step = verifyTotp(secret, code);
    if (step === null || BigInt(step) <= credential.lastVerifiedStep) return NextResponse.json({ error: "Código inválido ou já utilizado." }, { status: 400 });
    await prisma.$transaction(async (transaction) => {
      await transaction.adminTotpCredential.delete({ where: { id: credential.id } });
      await transaction.securityAuditEvent.create({ data: { acao: "ADMIN_TOTP_DISABLED", resultado: "success", atorId: auth.funcionario!.id, ipHash: getClientIpHash(request) } });
    });
    return NextResponse.json({ message: "Verificação em duas etapas desativada." });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao desativar TOTP", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível desativar a verificação em duas etapas.", errorId }, { status: 500 });
  }
}