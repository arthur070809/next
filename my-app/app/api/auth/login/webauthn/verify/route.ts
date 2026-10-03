import { randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { isLoginTemporarilyBlocked, recordLoginFailure } from "@/lib/login-attempts";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { isFactorBlocked, recordFactorFailure } from "@/lib/security-attempts";
import { getClientIpHash, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName } from "@/lib/webauthn";
import { createFaceNonce, hashFaceNonce, livenessChallengeTtlMs } from "@/lib/face";

const genericFailure = () => NextResponse.json({ error: "Não foi possível verificar o acesso. Tente novamente ou procure o administrador." }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const ipHash = getClientIpHash(request);
    if (isRateLimited(`webauthn-verify:${ipHash}`, 12, 15 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    if (Number(request.headers.get("content-length") ?? 0) > 65_536) return genericFailure();
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return genericFailure(); }
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    if (!challengeId || !body.credential || typeof body.credential !== "object") return genericFailure();

    const challenge = await prisma.authChallenge.findUnique({ where: { id: challengeId }, include: { funcionario: true, trustedDevice: true } });
    const now = new Date();
    if (!challenge || challenge.tipo !== "USER_WEBAUTHN" || challenge.usadoEm || challenge.expiraEm <= now || !challenge.challenge || !challenge.trustedDeviceId || !challenge.trustedDevice || challenge.trustedDevice.revogadoEm || !challenge.funcionario.ativo || challenge.funcionario.papel !== "ALMOXARIFE") return genericFailure();
    if (await isLoginTemporarilyBlocked(challenge.funcionario.cracha, ipHash)) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em 15 minutos." }, { status: 429 });
    }
    const factorKey = `${challenge.funcionarioId}:${challenge.trustedDeviceId}:${challenge.ipHash ?? ipHash}`;
    if (isFactorBlocked(factorKey)) return NextResponse.json({ error: "Verificação temporariamente bloqueada. Procure o administrador." }, { status: 429 });

    const deviceToken = (await cookies()).get(trustedDeviceCookieName)?.value;
    if (!deviceToken || hashSecret(deviceToken) !== challenge.trustedDevice.tokenHash) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      await prisma.$transaction(async (transaction) => {
        await transaction.authChallenge.updateMany({ where: { id: challenge.id, usadoEm: null }, data: { usadoEm: new Date() } });
        await transaction.securityAuditEvent.create({ data: { acao: "WEBAUTHN_LOGIN", resultado: "denied", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash, detalhe: "Aparelho incompatível." } });
      });
      return genericFailure();
    }

    const credentialResponse = body.credential as AuthenticationResponseJSON;
    const storedCredential = await prisma.webAuthnCredential.findFirst({
      where: { credentialId: typeof credentialResponse.id === "string" ? credentialResponse.id : "", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, revogadoEm: null },
    });
    if (!storedCredential) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      await prisma.$transaction(async (transaction) => {
        await transaction.authChallenge.updateMany({ where: { id: challenge.id, usadoEm: null }, data: { usadoEm: new Date() } });
        await transaction.securityAuditEvent.create({ data: { acao: "WEBAUTHN_LOGIN", resultado: "failure", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash } });
      });
      return genericFailure();
    }

    let verification;
    try {
      const relyingParty = getWebAuthnRelyingParty(request.url);
      verification = await verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: challenge.challenge,
        expectedOrigin: relyingParty.origin,
        expectedRPID: relyingParty.rpID,
        requireUserVerification: true,
        credential: {
          id: storedCredential.credentialId,
          publicKey: new Uint8Array(storedCredential.publicKey),
          counter: Number(storedCredential.counter),
          transports: storedCredential.transports ? JSON.parse(storedCredential.transports) : undefined,
        },
      });
    } catch { verification = null; }

    if (!verification?.verified || !verification.authenticationInfo.userVerified) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      await prisma.$transaction(async (transaction) => {
        await transaction.authChallenge.updateMany({ where: { id: challenge.id, usadoEm: null }, data: { usadoEm: new Date() } });
        await transaction.securityAuditEvent.create({ data: { acao: "WEBAUTHN_LOGIN", resultado: "failure", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash } });
      });
      return genericFailure();
    }

    const verifiedAt = new Date();
    const accepted = await prisma.$transaction(async (transaction) => {
      const usedChallenge = await transaction.authChallenge.updateMany({ where: { id: challenge.id, usadoEm: null, expiraEm: { gt: verifiedAt }, challenge: challenge.challenge, trustedDeviceId: challenge.trustedDeviceId }, data: { usadoEm: verifiedAt } });
      if (usedChallenge.count !== 1) return false;
      const credentialUpdated = await transaction.webAuthnCredential.updateMany({ where: { id: storedCredential.id, revogadoEm: null, counter: storedCredential.counter }, data: { counter: BigInt(verification.authenticationInfo.newCounter), ultimoUsoEm: verifiedAt } });
      if (credentialUpdated.count !== 1) return false;
      await transaction.trustedDevice.update({ where: { id: challenge.trustedDeviceId!, revogadoEm: null }, data: { ultimoAcessoEm: verifiedAt } });
      const templateCount = await transaction.faceTemplate.count({ where: { funcionarioId: challenge.funcionarioId, revogadoEm: null } });
      if (templateCount === 0) return false;
      const nonce = createFaceNonce();
      const faceChallenge = ["piscar", "virar_esquerda", "sorrir"][randomInt(0, 3)];
      await transaction.livenessChallenge.create({
        data: {
          funcionarioId: challenge.funcionarioId,
          trustedDeviceId: challenge.trustedDeviceId!,
          tipo: faceChallenge,
          nonceHash: hashFaceNonce(nonce),
          expiraEm: new Date(verifiedAt.getTime() + livenessChallengeTtlMs),
        },
      });
      await transaction.securityAuditEvent.create({ data: { acao: "WEBAUTHN_LOGIN", resultado: "success", funcionarioId: challenge.funcionarioId, trustedDeviceId: challenge.trustedDeviceId, ipHash, detalhe: "Aparelho verificado; vivacidade facial pendente." } });
      return nonce;
    }, { isolationLevel: "Serializable" });
    if (!accepted) {
      recordFactorFailure(factorKey);
      await recordLoginFailure(challenge.funcionario.cracha, ipHash);
      return genericFailure();
    }
    const funcionario = challenge.funcionario;
    const livenessChallenge = await prisma.livenessChallenge.findFirst({
      where: { funcionarioId: funcionario.id, trustedDeviceId: challenge.trustedDeviceId, nonceHash: hashFaceNonce(accepted), usadoEm: null },
      orderBy: { criadoEm: "desc" },
      select: { id: true, tipo: true, expiraEm: true },
    });
    if (!livenessChallenge) return genericFailure();
    return NextResponse.json({
      step: "face",
      challengeId: livenessChallenge.id,
      nonce: accepted,
      challenge: livenessChallenge.tipo,
      expiresAt: livenessChallenge.expiraEm,
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha na verificação WebAuthn", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível verificar o acesso.", errorId }, { status: 500 });
  }
}