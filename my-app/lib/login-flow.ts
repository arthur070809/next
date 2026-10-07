import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { OPERATOR_IDLE_TIMEOUT_MS } from "@/lib/session-policy";
import { papelParaRole, sessionCookieName } from "@/lib/auth";
import { createFaceNonce, hashFaceNonce } from "@/lib/face";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/webauthn";

const PERFIS_COM_FACIAL = [PapelFuncionario.ADMIN] as const;
const loginFaceChallengeTtlMs = 60 * 1000;
let disabledWarningShown = false;

type LoginFaceState = {
  challengeId: string;
  funcionarioId: number;
  expiresAt: number;
  nonceHash: string;
  challenge: string;
};

type IdentifyFaceState = {
  challengeId: string;
  expiresAt: number;
  nonceHash: string;
  challenge: string;
  tipo: "LOGIN_FACE_IDENTIFY";
};

type LoginEmployee = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  cracha: string;
  papel: PapelFuncionario;
  mustChangePassword: boolean;
};

function challengeSigningKey() {
  const secret = process.env.LOGIN_CHALLENGE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("LOGIN_CHALLENGE_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function encodeState(state: LoginFaceState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", challengeSigningKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyLoginFaceState(token: string): LoginFaceState | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = createHmac("sha256", challengeSigningKey()).update(payload).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Partial<LoginFaceState>;
    if (
      typeof state.challengeId !== "string" ||
      !Number.isSafeInteger(state.funcionarioId) ||
      typeof state.expiresAt !== "number" ||
      typeof state.nonceHash !== "string" ||
      typeof state.challenge !== "string"
    ) return null;
    return state as LoginFaceState;
  } catch {
    return null;
  }
}

function encodeIdentifyFaceState(state: IdentifyFaceState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", challengeSigningKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyIdentifyFaceState(token: string): IdentifyFaceState | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = createHmac("sha256", challengeSigningKey()).update(payload).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Partial<IdentifyFaceState>;
    if (
      typeof state.challengeId !== "string" ||
      typeof state.expiresAt !== "number" ||
      typeof state.nonceHash !== "string" ||
      typeof state.challenge !== "string" ||
      state.tipo !== "LOGIN_FACE_IDENTIFY"
    ) return null;
    return state as IdentifyFaceState;
  } catch {
    return null;
  }
}

export function loginRequiresFace(papel: PapelFuncionario) {
  if (process.env.LOGIN_FACIAL_OBRIGATORIO === "false") {
    if (!disabledWarningShown) {
      const production = process.env.NODE_ENV === "production";
      console.warn(production
        ? "[auth] LOGIN_FACIAL_OBRIGATORIO=false foi ignorado em produção; a exigência facial permanece ativa."
        : "[auth] Login facial está temporariamente desativado por LOGIN_FACIAL_OBRIGATORIO=false.");
      disabledWarningShown = true;
    }
    if (process.env.NODE_ENV !== "production") return false;
  }
  return PERFIS_COM_FACIAL.some((profile) => profile === papel);
}

export async function createLoginFaceChallenge(funcionarioId: number, ipHash: string) {
  const nonce = createFaceNonce();
  const challenge = ["piscar", "virar_esquerda", "sorrir"][randomBytes(1)[0] % 3];
  const expiresAt = new Date(Date.now() + loginFaceChallengeTtlMs);
  const challengeId = randomUUID();
  const state: LoginFaceState = {
    challengeId,
    funcionarioId,
    expiresAt: expiresAt.getTime(),
    nonceHash: hashFaceNonce(nonce),
    challenge,
  };
  const loginToken = encodeState(state);
  const created = await prisma.authChallenge.create({
    data: {
      id: challengeId,
      tipo: "LOGIN_FACE",
      challenge,
      funcionarioId,
      ipHash,
      preAuthTokenHash: hashSecret(loginToken),
      expiraEm: expiresAt,
    },
    select: { id: true },
  });
  return {
    step: "face" as const,
    challengeId: created.id,
    loginToken,
    nonce,
    challenge,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createIdentifyFaceChallenge(ipHash: string) {
  const nonce = createFaceNonce();
  const challenge = ["piscar", "virar_esquerda", "sorrir"][randomBytes(1)[0] % 3];
  const expiresAt = new Date(Date.now() + loginFaceChallengeTtlMs);
  const challengeId = randomUUID();
  const state: IdentifyFaceState = {
    challengeId,
    expiresAt: expiresAt.getTime(),
    nonceHash: hashFaceNonce(nonce),
    challenge,
    tipo: "LOGIN_FACE_IDENTIFY",
  };
  const loginToken = encodeIdentifyFaceState(state);
  try {
    const fallbackEmployee = await prisma.funcionario.findFirst({ where: { ativo: true }, select: { id: true } });
    if (fallbackEmployee) {
      await prisma.authChallenge.create({
        data: {
          id: challengeId,
          tipo: "LOGIN_FACE_IDENTIFY",
          challenge,
          funcionarioId: fallbackEmployee.id,
          ipHash,
          preAuthTokenHash: hashSecret(loginToken),
          expiraEm: expiresAt,
        },
        select: { id: true },
      });
    }
  } catch {
    // The generic identify flow is intentionally not bound to a specific employee;
    // keep the signed challenge token as the source of truth when no employee placeholder is available.
  }
  return {
    step: "face" as const,
    challengeId,
    loginToken,
    nonce,
    challenge,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createLoginSessionResponse(
  funcionario: LoginEmployee,
  accessArea: string,
  trustedDeviceId: string | null = null,
) {
  const token = randomBytes(32).toString("hex");
  const sessionTtlMs = funcionario.papel === PapelFuncionario.OPERADOR
    ? OPERATOR_IDLE_TIMEOUT_MS
    : 8 * 60 * 60 * 1000;
  const currentEmployee = await prisma.$transaction(async (transaction) => {
    const current = await transaction.funcionario.findFirst({
      where: { id: funcionario.id, ativo: true, papel: funcionario.papel },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        cracha: true,
        papel: true,
        mustChangePassword: true,
      },
    });
    if (!current) return null;
    await transaction.sessao.create({
      data: {
        token,
        funcionarioId: current.id,
        ultimoSinalEm: new Date(),
        accessArea,
        trustedDeviceId,
        expiresAt: new Date(Date.now() + sessionTtlMs),
      },
    });
    return current;
  });
  if (!currentEmployee) return null;

  return createLoginSessionSuccessResponse(currentEmployee, token);
}

export function createLoginSessionSuccessResponse(
  currentEmployee: LoginEmployee,
  token: string,
) {
  const response = NextResponse.json({
    message: "Login realizado com sucesso.",
    funcionario: {
      id: currentEmployee.id,
      nome: currentEmployee.nome,
      email: currentEmployee.email,
      cargo: currentEmployee.cargo,
      cracha: currentEmployee.cracha,
      role: papelParaRole(currentEmployee.papel),
      papel: currentEmployee.papel,
      mustChangePassword: currentEmployee.mustChangePassword,
    },
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  } as const;
  response.cookies.set(sessionCookieName, token, cookieOptions);
  return response;
}

export function getLoginAccessArea(papel: PapelFuncionario) {
  switch (papel) {
    case PapelFuncionario.ADMIN:
      return "admin";
    case PapelFuncionario.OPERADOR:
      return "operador";
    case PapelFuncionario.ALMOXARIFE:
    case PapelFuncionario.USUARIO:
      return "almoxarifado";
  }
}
