import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getClientIpHash, hashSecret, pairingCodeTtlMs } from "@/lib/webauthn";

function adminError(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado." }, { status });
}

function deviceLimit() {
  const parsed = Number.parseInt(process.env.TRUSTED_DEVICE_LIMIT ?? "7", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 50 ? parsed : 7;
}

function newPairingCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
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
            select: { id: true, funcionario: { select: { id: true, nome: true, cracha: true } }, criadoEm: true, consentVersion: true },
          },
        },
      }),
      prisma.funcionario.findMany({
        where: { papel: "ALMOXARIFE", ativo: true },
        select: { id: true, nome: true, cracha: true },
        orderBy: { nome: "asc" },
      }),
    ]);
    return NextResponse.json({ devices, employees, limit: deviceLimit() });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao listar dispositivos confiáveis", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar os dispositivos.", errorId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Envie os dados do dispositivo em formato válido." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const employeeId = Number(body.funcionarioId);
    if (name.length < 2 || name.length > 80 || !Number.isSafeInteger(employeeId) || employeeId < 1) {
      return NextResponse.json({ error: "Informe um apelido (2 a 80 caracteres) e um funcionário válido." }, { status: 400 });
    }

    const employee = await prisma.funcionario.findFirst({ where: { id: employeeId, papel: "ALMOXARIFE", ativo: true }, select: { id: true } });
    if (!employee) return NextResponse.json({ error: "Funcionário não encontrado ou inativo." }, { status: 404 });

    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + pairingCodeTtlMs);
    const created = await prisma.$transaction(async (transaction) => {
      const currentCount = await transaction.trustedDevice.count({ where: { revogadoEm: null } });
      if (currentCount >= deviceLimit()) return null;

      const device = await transaction.trustedDevice.create({ data: { nome: name } });
      await transaction.devicePairing.create({
        data: {
          codeHash: hashSecret(code),
          trustedDeviceId: device.id,
          funcionarioId: employeeId,
          criadoPorId: auth.funcionario.id,
          expiraEm: expiresAt,
        },
      });
      await transaction.securityAuditEvent.create({
        data: {
          acao: "DEVICE_PAIRING_CREATED",
          resultado: "success",
          funcionarioId: employeeId,
          atorId: auth.funcionario.id,
          trustedDeviceId: device.id,
          ipHash: getClientIpHash(request),
        },
      });
      return device;
    }, { isolationLevel: "Serializable" });

    if (!created) return NextResponse.json({ error: `Limite de ${deviceLimit()} dispositivos confiáveis atingido.` }, { status: 409 });
    return NextResponse.json({ device: { id: created.id, nome: created.nome }, pairingCode: code, expiresAt }, { status: 201 });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao criar pareamento de dispositivo", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível criar o pareamento.", errorId }, { status: 500 });
  }
}