import { randomUUID } from "node:crypto";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { getClientIpHash, getWebAuthnRelyingParty, hashSecret, webauthnChallengeTtlMs } from "@/lib/webauthn";

const invalidPairing = () => NextResponse.json({ error: "Código de pareamento inválido ou expirado." }, { status: 400 });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const ipHash = getClientIpHash(request);
    if (isRateLimited(`device-pair-options:${ipHash}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde e tente novamente." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return invalidPairing();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return invalidPairing();
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (code.length < 12 || code.length > 32) return invalidPairing();

    const pairing = await prisma.devicePairing.findUnique({
      where: { codeHash: hashSecret(code) },
      include: { trustedDevice: true, funcionario: true },
    });
    const now = new Date();
    if (!pairing || pairing.usadoEm || pairing.expiraEm <= now || !pairing.funcionario.ativo || pairing.funcionario.role !== "user" || pairing.trustedDevice.revogadoEm) {
      await prisma.securityAuditEvent.create({
        data: { acao: "DEVICE_PAIRING_ATTEMPT", resultado: "denied", ipHash },
      });
      return invalidPairing();
    }

    const relyingParty = getWebAuthnRelyingParty(request.url);
    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { funcionarioId: pairing.funcionarioId, trustedDeviceId: pairing.trustedDeviceId, revogadoEm: null },
      select: { credentialId: true, transports: true },
    });
    const options = await generateRegistrationOptions({
      rpName: relyingParty.rpName,
      rpID: relyingParty.rpID,
      userName: pairing.funcionario.cracha,
      userID: Buffer.from(String(pairing.funcionario.id)),
      userDisplayName: pairing.funcionario.nome,
      attestationType: "none",
      timeout: webauthnChallengeTtlMs,
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      preferredAuthenticatorType: "localDevice",
    });
    const challengeExpiresAt = new Date(Math.min(now.getTime() + webauthnChallengeTtlMs, pairing.expiraEm.getTime()));
    const updated = await prisma.devicePairing.updateMany({
      where: { id: pairing.id, usadoEm: null, expiraEm: { gt: now } },
      data: { challenge: options.challenge, challengeExpiraEm: challengeExpiresAt },
    });
    if (updated.count !== 1) return invalidPairing();

    await prisma.securityAuditEvent.create({
      data: {
        acao: "DEVICE_ENROLLMENT_STARTED",
        resultado: "success",
        funcionarioId: pairing.funcionarioId,
        trustedDeviceId: pairing.trustedDeviceId,
        ipHash,
      },
    });
    return NextResponse.json({ pairingId: pairing.id, options, consentVersion: "webauthn-local-verification-v1" });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao iniciar pareamento WebAuthn", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível iniciar o pareamento.", errorId }, { status: 500 });
  }
}