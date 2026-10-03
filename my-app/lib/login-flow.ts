import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { papelParaRole, sessionCookieName } from "@/lib/auth";
import { createFaceNonce, hashFaceNonce } from "@/lib/face";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/webauthn";

const facialProfiles = [PapelFuncionario.ADMIN] as const;
const loginFaceChallengeTtlMs = 60 * 1000;
let disabledWarningShown = false;

type LoginFaceState = {
  challengeId: string;
  funcionarioId: number;
  expiresAt: number;
  nonceHash: string;
  challenge: string;
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

export function loginRequiresFace(papel: PapelFuncionario) {
  if (process.env.LOGIN_FACIAL_OBRIGATORIO === "false") {
    if (!disabledWarningShown) {
      console.warn("[auth] Login facial está temporariamente desativado por LOGIN_FACIAL_OBRIGATORIO=false.");
      disabledWarningShown = true;
    }
    return false;
  }
  return facialProfiles.some((profile) => profile === papel);
}

export async function createLoginFaceChallenge(funcionarioId: number, ipHash: string) {
  const nonce = createFaceNonce();
  const challenge = ["piscar", "virar_esquerda", "sorrir"][randomBytes(1)[0] % 3];
  const expiresAt = new Date(Date.now() + loginFaceChallengeTtlMs);
  const created = await prisma.authChallenge.create({
    data: {
      tipo: "LOGIN_FACE",
      challenge,
      funcionarioId,
      ipHash,
      expiraEm: expiresAt,
    },
    select: { id: true },
  });
  const state: LoginFaceState = {
    challengeId: created.id,
    funcionarioId,
    expiresAt: expiresAt.getTime(),
    nonceHash: hashFaceNonce(nonce),
    challenge,
  };
  const loginToken = encodeState(state);
  await prisma.authChallenge.update({
    where: { id: created.id },
    data: { preAuthTokenHash: hashSecret(loginToken) },
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

export async function createLoginSessionResponse(
  funcionario: LoginEmployee,
  accessArea: string,
  trustedDeviceId: string | null = null,
) {
  const token = randomBytes(32).toString("hex");
  await prisma.sessao.create({
    data: {
      token,
      funcionarioId: funcionario.id,
      accessArea,
      trustedDeviceId,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  const response = NextResponse.json({
    message: "Login realizado com sucesso.",
    funcionario: {
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email,
      cargo: funcionario.cargo,
      cracha: funcionario.cracha,
      role: papelParaRole(funcionario.papel),
      papel: funcionario.papel,
      mustChangePassword: funcionario.mustChangePassword,
    },
  });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
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
