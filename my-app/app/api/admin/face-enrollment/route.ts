import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { areEnrollmentEmbeddingsConsistent, decryptEmbedding, encryptEmbedding, enrollFaceSamples, faceEmbeddingDistance, faceEnrollmentDuplicateDistance, FaceEnrollmentVerificationError, faceConsentVersion } from "@/lib/face";
import { faceEnrollmentAttemptLimit, getFaceEnrollmentLimit, recordFaceEnrollmentFailure } from "@/lib/face-enrollment-attempts";
import { createFaceEnrollmentSession, findFaceEnrollmentSession, renewFaceEnrollmentSession } from "@/lib/face-enrollment-session";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getClientIpHash, hashSecret } from "@/lib/webauthn";

const adminError = (status: 401 | 403) => NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado.", code: status === 401 ? "AUTH_REQUIRED" : "ADMIN_REQUIRED" }, { status });
const apiError = (status: number, code: string, error: string, errorId?: string, headers?: HeadersInit) => NextResponse.json({ error, code, ...(errorId ? { errorId } : {}) }, { status, headers });

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    const employees = await prisma.funcionario.findMany({ where: { role: "user", ativo: true }, select: { id: true, nome: true, cracha: true }, orderBy: { nome: "asc" } });
    const statuses = await Promise.all(employees.map(async (employee) => ({
      ...employee,
      enrolled: await prisma.faceTemplate.count({ where: { funcionarioId: employee.id, revogadoEm: null } }) > 0,
    })));
    const requestedEmployeeId = Number(new URL(request.url).searchParams.get("funcionarioId"));
    const employee = statuses.find((item) => item.id === requestedEmployeeId);
    const session = employee ? await createFaceEnrollmentSession(auth.funcionario.id, employee.id) : null;
    return NextResponse.json({ employees: statuses, session: session ? { id: session.id, token: session.token, expiraEm: session.expiraEm.toISOString() } : null });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao listar enrollment facial", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError(500, "FACE_ENROLLMENT_LIST_FAILED", "Não foi possível carregar os funcionários.", errorId);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 12 * 1024 * 1024) return NextResponse.json({ error: "Capturas muito grandes." }, { status: 400 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const funcionarioId = Number(body.funcionarioId);
    const consentAt = typeof body.consentAt === "string" ? new Date(body.consentAt) : new Date();
    const consent = body.consent === true;
    const samples = Array.isArray(body.samples) ? body.samples : [];
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
    if (!Number.isSafeInteger(funcionarioId) || funcionarioId < 1 || !consent || !Number.isFinite(consentAt.getTime()) || samples.length < 3 || samples.length > 5 || !sessionId || !sessionToken) {
      return apiError(400, "FACE_ENROLLMENT_PAYLOAD_INVALID", "Confirme o consentimento e conclua a captura guiada.");
    }
    const employee = await prisma.funcionario.findFirst({ where: { id: funcionarioId, role: "user", ativo: true }, select: { id: true } });
    if (!employee) return apiError(404, "EMPLOYEE_NOT_FOUND", "Funcionário não encontrado ou inativo.");
    const session = await findFaceEnrollmentSession(sessionId, sessionToken, auth.funcionario.id, employee.id);
    if (!session) return apiError(409, "FACE_ENROLLMENT_SESSION_EXPIRED", "A sessão expirou. Reinicie a captura.");

    const ipHash = getClientIpHash(request);
    const retryAfterSeconds = await getFaceEnrollmentLimit(auth.funcionario.id, employee.id);
    if (retryAfterSeconds !== null) {
      return apiError(429, "FACE_ENROLLMENT_RATE_LIMITED", "Muitas tentativas. Aguarde e tente novamente.", undefined, { "Retry-After": String(retryAfterSeconds) });
    }

    let embeddings: number[][];
    try {
      embeddings = await enrollFaceSamples(samples, { nonce: sessionToken });
    } catch (error) {
      if (error instanceof FaceEnrollmentVerificationError) {
        const failure = await recordFaceEnrollmentFailure(auth.funcionario.id, employee.id);
        if (failure.count >= faceEnrollmentAttemptLimit) {
          return apiError(429, "FACE_ENROLLMENT_RATE_LIMITED", "Muitas tentativas. Aguarde e tente novamente.", undefined, { "Retry-After": String(failure.retryAfterSeconds) });
        }
        return apiError(422, error.code, error.message);
      }
      throw error;
    }
    if (!areEnrollmentEmbeddingsConsistent(embeddings)) {
      const failure = await recordFaceEnrollmentFailure(auth.funcionario.id, employee.id);
      return apiError(failure.count >= faceEnrollmentAttemptLimit ? 429 : 422, failure.count >= faceEnrollmentAttemptLimit ? "FACE_ENROLLMENT_RATE_LIMITED" : "FACE_INCONSISTENT_SAMPLES", failure.count >= faceEnrollmentAttemptLimit ? "Muitas tentativas. Aguarde e tente novamente." : "As capturas ficaram diferentes. Tente novamente.", undefined, failure.count >= faceEnrollmentAttemptLimit ? { "Retry-After": String(failure.retryAfterSeconds) } : undefined);
    }
    const otherTemplates = await prisma.faceTemplate.findMany({ where: { funcionarioId: { not: employee.id }, revogadoEm: null }, select: { embeddingEncrypted: true, iv: true, tag: true, funcionario: { select: { nome: true } } } });
    for (const template of otherTemplates) {
      if (embeddings.some((embedding) => faceEmbeddingDistance(embedding, decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag)) <= faceEnrollmentDuplicateDistance)) {
        return apiError(409, "FACE_DUPLICATE", `Este rosto já está cadastrado para ${template.funcionario.nome}.`);
      }
    }
    const enrolledAt = new Date();
    const saved = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.faceEnrollmentSession.updateMany({ where: { id: session.id, tokenHash: hashSecret(sessionToken), adminId: auth.funcionario.id, funcionarioId: employee.id, usadoEm: null, expiraEm: { gt: enrolledAt } }, data: { usadoEm: enrolledAt, ultimaAtividade: enrolledAt } });
      if (consumed.count !== 1) return false;
      await transaction.faceTemplate.updateMany({ where: { funcionarioId, revogadoEm: null }, data: { revogadoEm: enrolledAt } });
      for (const embedding of embeddings) {
        const encrypted = encryptEmbedding(embedding);
        await transaction.faceTemplate.create({ data: {
          funcionarioId,
          embeddingEncrypted: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          consentVersion: faceConsentVersion,
          consentAt,
          criadoPorId: auth.funcionario.id,
        } });
      }
      await transaction.securityAuditEvent.create({ data: { acao: "FACE_ENROLLMENT", resultado: "success", funcionarioId, atorId: auth.funcionario.id, ipHash, detalhe: `Consentimento ${faceConsentVersion}; ${embeddings.length} amostras.` } });
      await transaction.faceEnrollmentAttempt.deleteMany({ where: { adminId: auth.funcionario.id, funcionarioId, resultado: "verification_failure" } });
      return true;
    });
    if (!saved) return apiError(409, "FACE_ENROLLMENT_SESSION_EXPIRED", "A sessão expirou. Reinicie a captura.");
    return NextResponse.json({ message: "Biometria cadastrada com sucesso.", code: "FACE_ENROLLMENT_CREATED", samples: embeddings.length }, { status: 201 });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha no cadastro facial", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError(500, "FACE_ENROLLMENT_SAVE_FAILED", "Não foi possível concluir o cadastro. Tente novamente.", errorId);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    if (!isSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Origem inválida.");
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const funcionarioId = Number(body.funcionarioId);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
    if (!Number.isSafeInteger(funcionarioId) || !sessionId || !sessionToken) return apiError(400, "FACE_ENROLLMENT_SESSION_INVALID", "Sessão de captura inválida.");
    const expiraEm = await renewFaceEnrollmentSession(sessionId, sessionToken, auth.funcionario.id, funcionarioId);
    if (!expiraEm) return apiError(409, "FACE_ENROLLMENT_SESSION_EXPIRED", "A sessão expirou. Reinicie a captura.");
    return NextResponse.json({ code: "FACE_ENROLLMENT_SESSION_RENEWED", expiraEm: expiraEm.toISOString() });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao renovar sessão facial", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError(500, "FACE_ENROLLMENT_SESSION_FAILED", "Não foi possível manter a sessão de captura.", errorId);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const funcionarioId = Number(body.funcionarioId);
    if (!Number.isSafeInteger(funcionarioId) || funcionarioId < 1) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });
    const revokedAt = new Date();
    const result = await prisma.$transaction(async (transaction) => {
      const revoked = await transaction.faceTemplate.updateMany({ where: { funcionarioId, revogadoEm: null }, data: { revogadoEm: revokedAt } });
      await transaction.securityAuditEvent.create({ data: { acao: "FACE_ENROLLMENT_DELETED", resultado: "success", funcionarioId, atorId: auth.funcionario.id, ipHash: getClientIpHash(request) } });
      return revoked.count;
    });
    return NextResponse.json({ message: "Cadastro facial removido.", code: "FACE_ENROLLMENT_REMOVED", revoked: result });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao excluir cadastro facial", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError(500, "FACE_ENROLLMENT_REMOVE_FAILED", "Não foi possível remover o cadastro facial.", errorId);
  }
}