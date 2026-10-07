import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { aggregateEnrollmentEmbeddings, assertFaceTemplateConfiguration, decryptEmbedding, encryptEmbedding, faceEmbeddingDistance, FaceEncryptionKeyUnavailableError, FaceEnrollmentVerificationError, FaceRecognitionUnavailableError, faceConsentVersion, getFaceMatchThreshold, validateFaceEmbedding } from "@/lib/face";
import { faceEnrollmentAttemptLimit, getFaceEnrollmentLimit, recordFaceEnrollmentFailure } from "@/lib/face-enrollment-attempts";
import { createFaceEnrollmentSession, findFaceEnrollmentSession, renewFaceEnrollmentSession } from "@/lib/face-enrollment-session";
import { faceEmbeddingDimension, faceEnrollmentMaximumBurstSize, getFaceEnrollmentFrameCount, isFaceEnrollmentConsentRequired } from "@/lib/facial/config";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getClientIpHash, hashSecret } from "@/lib/webauthn";

const adminError = (status: 401 | 403) => NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado.", code: status === 401 ? "AUTH_REQUIRED" : "ADMIN_REQUIRED" }, { status });
const apiError = (status: number, code: string, error: string, errorId?: string, headers?: HeadersInit) => NextResponse.json({ error, code, ...(errorId ? { errorId } : {}) }, { status, headers });
const diagnosticsEnabled = () => process.env.FACE_DIAGNOSTICS_ENABLED === "true";

function isMissingFaceSchema(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "P2021" || error.code === "P2022";
}

function prismaErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "unknown";
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.funcionario) return adminError(auth.status);
    try {
      assertFaceTemplateConfiguration();
    } catch (error) {
      if (error instanceof FaceEncryptionKeyUnavailableError || error instanceof FaceRecognitionUnavailableError) {
        console.error("[face] Cadastro facial indisponível: configure a chave e a versão do modelo.");
        return apiError(503, "FACE_CONFIGURATION_UNAVAILABLE", "O cadastro facial está temporariamente indisponível.");
      }
      throw error;
    }
    const employees = await prisma.funcionario.findMany({ where: { papel: { in: ["ADMIN", "ALMOXARIFE"] }, ativo: true }, select: { id: true, nome: true, cracha: true }, orderBy: { nome: "asc" } });
    const statuses = await Promise.all(employees.map(async (employee) => ({
      ...employee,
      enrolled: await prisma.faceTemplate.count({ where: { funcionarioId: employee.id, revogadoEm: null } }) > 0,
    })));
    const requestedEmployeeId = Number(new URL(request.url).searchParams.get("funcionarioId"));
    const employee = statuses.find((item) => item.id === requestedEmployeeId);
    const session = employee ? await createFaceEnrollmentSession(auth.funcionario.id, employee.id) : null;
    return NextResponse.json({ employees: statuses, session: session ? { id: session.id, token: session.token, expiraEm: session.expiraEm.toISOString() } : null });
  } catch (error) {
    if (isMissingFaceSchema(error)) {
      console.error("[face] Cadastro indisponível: aplique a migration de templates faciais.", { code: prismaErrorCode(error) });
      return apiError(503, "FACE_SCHEMA_UNAVAILABLE", "O cadastro facial está temporariamente indisponível.");
    }
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
    const frameCount = getFaceEnrollmentFrameCount();
    const maxPayloadBytes = frameCount * faceEmbeddingDimension * 32 + 16 * 1024;
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxPayloadBytes)) {
      return NextResponse.json({ error: "Capturas muito grandes." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const funcionarioId = Number(body.funcionarioId);
    const consentRequired = isFaceEnrollmentConsentRequired();
    const submittedConsentAt = typeof body.consentAt === "string" ? new Date(body.consentAt) : null;
    const consent = body.consent === true;
    const samples = Array.isArray(body.samples) ? body.samples : [];
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
    const replaceConfirmed = body.replaceConfirmed === true;
    const invalidPayloadMessage = consentRequired
      ? "Confirme o consentimento e conclua a captura guiada."
      : "Revise os dados e conclua a captura guiada.";
    if (!Number.isSafeInteger(funcionarioId) || funcionarioId < 1
      || (consentRequired && (!consent || !submittedConsentAt || !Number.isFinite(submittedConsentAt.getTime())))
      || samples.length !== frameCount || frameCount > faceEnrollmentMaximumBurstSize || !sessionId || !sessionToken) {
      return apiError(400, "FACE_ENROLLMENT_PAYLOAD_INVALID", invalidPayloadMessage);
    }
    const consentAt = consentRequired && submittedConsentAt ? submittedConsentAt : new Date();
    const employee = await prisma.funcionario.findFirst({ where: { id: funcionarioId, papel: { in: ["ADMIN", "ALMOXARIFE"] }, ativo: true }, select: { id: true } });
    if (!employee) return apiError(404, "EMPLOYEE_NOT_FOUND", "Funcionário não encontrado ou inativo.");
    let modelVersion: string;
    try {
      modelVersion = assertFaceTemplateConfiguration();
    } catch (error) {
      if (error instanceof FaceEncryptionKeyUnavailableError || error instanceof FaceRecognitionUnavailableError) {
        console.error("[face] Cadastro facial indisponível: configure a chave e a versão do modelo.");
        return apiError(503, "FACE_CONFIGURATION_UNAVAILABLE", "O cadastro facial está temporariamente indisponível.");
      }
      throw error;
    }
    const activeTemplateCount = await prisma.faceTemplate.count({ where: { funcionarioId, revogadoEm: null } });
    if (activeTemplateCount > 0 && !replaceConfirmed) {
      return apiError(409, "FACE_REPLACEMENT_CONFIRMATION_REQUIRED", "Confirme a substituição do cadastro facial existente.");
    }
    const session = await findFaceEnrollmentSession(sessionId, sessionToken, auth.funcionario.id, employee.id);
    if (!session) return apiError(409, "FACE_ENROLLMENT_SESSION_EXPIRED", "A sessão expirou. Reinicie a captura.");

    const ipHash = getClientIpHash(request);
    const retryAfterSeconds = await getFaceEnrollmentLimit(auth.funcionario.id, employee.id);
    if (retryAfterSeconds !== null) {
      return apiError(429, "FACE_ENROLLMENT_RATE_LIMITED", "Muitas tentativas. Aguarde e tente novamente.", undefined, { "Retry-After": String(retryAfterSeconds) });
    }

    let embeddings: number[][];
    try {
      embeddings = samples.map(validateFaceEmbedding);
    } catch (error) {
      const failure = await recordFaceEnrollmentFailure(auth.funcionario.id, employee.id);
      if (failure.count >= faceEnrollmentAttemptLimit) {
        return apiError(429, "FACE_ENROLLMENT_RATE_LIMITED", "Muitas tentativas. Aguarde e tente novamente.", undefined, { "Retry-After": String(failure.retryAfterSeconds) });
      }
      const code = error instanceof FaceEnrollmentVerificationError ? error.code : "FACE_INVALID_VECTOR";
      return apiError(422, code, "Não foi possível validar a captura facial. Olhe de frente e tente novamente.");
    }
    const consistency = aggregateEnrollmentEmbeddings(embeddings);
    if (!consistency.consistent || !consistency.embedding) {
      return apiError(409, "FACE_CAPTURE_RETRY", "Mantenha apenas seu rosto diante da câmera.");
    }
    const enrollmentEmbedding = consistency.embedding;
    const compatibleTemplates = await prisma.faceTemplate.findMany({
      where: { revogadoEm: null, modelVersion },
      select: {
        funcionarioId: true,
        embeddingEncrypted: true,
        iv: true,
        tag: true,
        funcionario: { select: { nome: true, cracha: true } },
      },
    });
    const comparisons = compatibleTemplates.flatMap((template) => {
      const distance = faceEmbeddingDistance(
        enrollmentEmbedding,
        decryptEmbedding(template.embeddingEncrypted, template.iv, template.tag),
      );
      return Number.isFinite(distance) ? [{
        nome: template.funcionario.nome,
        cracha: template.funcionario.cracha,
        relation: template.funcionarioId === employee.id ? "same" as const : "different" as const,
        distance,
      }] : [];
    });
    let duplicateThreshold: number | null = null;
    try {
      duplicateThreshold = getFaceMatchThreshold();
    } catch (error) {
      if (!(error instanceof FaceRecognitionUnavailableError)) throw error;
    }
    if (duplicateThreshold === null && comparisons.length > 0) {
      if (!diagnosticsEnabled()) throw new FaceRecognitionUnavailableError();
      return NextResponse.json({
        error: "O limiar MobileFace precisa ser configurado após avaliar as distâncias reais.",
        code: "FACE_THRESHOLD_CALIBRATION_REQUIRED",
        diagnostics: { comparisons, modelVersion },
      }, { status: 409 });
    }
    for (const comparison of comparisons) {
      if (comparison.relation === "different" && duplicateThreshold !== null && comparison.distance < duplicateThreshold) {
        return apiError(409, "FACE_DUPLICATE", `Este rosto já está cadastrado para ${comparison.nome}.`);
      }
    }
    const enrolledAt = new Date();
    const saved = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.faceEnrollmentSession.updateMany({ where: { id: session.id, tokenHash: hashSecret(sessionToken), adminId: auth.funcionario.id, funcionarioId: employee.id, usadoEm: null, expiraEm: { gt: enrolledAt } }, data: { usadoEm: enrolledAt, ultimaAtividade: enrolledAt } });
      if (consumed.count !== 1) return false;
      await transaction.faceTemplate.updateMany({ where: { funcionarioId, revogadoEm: null }, data: { revogadoEm: enrolledAt } });
      const encrypted = encryptEmbedding(enrollmentEmbedding);
      await transaction.faceTemplate.create({ data: {
        funcionarioId,
        embeddingEncrypted: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        modelVersion,
        consentVersion: consentRequired ? faceConsentVersion : "not-collected",
        consentAt,
        criadoPorId: auth.funcionario.id,
        criadoEm: enrolledAt,
        atualizadoEm: enrolledAt,
      } });
      const consentAudit = consentRequired ? `Consentimento ${faceConsentVersion}` : "Aviso de privacidade não coletado; revisão jurídica pendente";
      await transaction.securityAuditEvent.create({ data: { acao: "FACE_ENROLLMENT", resultado: "success", funcionarioId, atorId: auth.funcionario.id, ipHash, detalhe: `${consentAudit}; ${samples.length} quadros agregados.` } });
      await transaction.faceEnrollmentAttempt.deleteMany({ where: { adminId: auth.funcionario.id, funcionarioId, resultado: "verification_failure" } });
      return true;
    });
    if (!saved) return apiError(409, "FACE_ENROLLMENT_SESSION_EXPIRED", "A sessão expirou. Reinicie a captura.");
    return NextResponse.json({
      message: "Biometria cadastrada com sucesso.",
      code: "FACE_ENROLLMENT_CREATED",
      samples: samples.length,
      ...(diagnosticsEnabled() ? {
        diagnostics: {
          comparisons,
          modelVersion,
        },
      } : {}),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof FaceRecognitionUnavailableError || error instanceof FaceEncryptionKeyUnavailableError) {
      console.error("[face] Cadastro facial indisponível por configuração local.");
      return apiError(503, "FACE_CONFIGURATION_UNAVAILABLE", "O reconhecimento facial está temporariamente indisponível. Tente novamente.");
    }
    if (isMissingFaceSchema(error)) {
      console.error("[face] Cadastro indisponível: aplique a migration de templates faciais.", { code: prismaErrorCode(error) });
      return apiError(503, "FACE_SCHEMA_UNAVAILABLE", "O cadastro facial está temporariamente indisponível.");
    }
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