import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, isSameOrigin } from "@/lib/security";
import { getClientIpHash, getWebAuthnRelyingParty, hashSecret, trustedDeviceCookieName, webauthnUserConsentVersion } from "@/lib/webauthn";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const ipHash = getClientIpHash(request);
    if (isRateLimited(`device-pair-complete:${ipHash}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde e tente novamente." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 65_536) {
      return NextResponse.json({ error: "Resposta do autenticador inválida." }, { status: 400 });
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Resposta do autenticador inválida." }, { status: 400 });
    }
    const pairingId = typeof body.pairingId === "string" ? body.pairingId : "";
    if (!pairingId || body.consent !== true || !body.credential || typeof body.credential !== "object") {
      return NextResponse.json({ error: "Confirme o uso do autenticador e conclua o pareamento." }, { status: 400 });
    }

    const pairing = await prisma.devicePairing.findUnique({
      where: { id: pairingId },
      include: { trustedDevice: true, funcionario: true },
    });
    const now = new Date();
    if (!pairing || pairing.usadoEm || pairing.expiraEm <= now || !pairing.challenge || !pairing.challengeExpiraEm || pairing.challengeExpiraEm <= now || pairing.trustedDevice.revogadoEm || !pairing.funcionario.ativo) {
      return NextResponse.json({ error: "O pareamento expirou. Solicite um novo código ao administrador." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const existingDeviceToken = cookieStore.get(trustedDeviceCookieName)?.value;
    if (pairing.trustedDevice.tokenHash && (!existingDeviceToken || hashSecret(existingDeviceToken) !== pairing.trustedDevice.tokenHash)) {
      await prisma.securityAuditEvent.create({
        data: { acao: "DEVICE_PAIRING_ATTEMPT", resultado: "denied", funcionarioId: pairing.funcionarioId, trustedDeviceId: pairing.trustedDeviceId, ipHash },
      });
      return NextResponse.json({ error: "O pareamento deve ser realizado no aparelho cadastrado." }, { status: 403 });
    }

    const relyingParty = getWebAuthnRelyingParty(request.url);
    const verification = await verifyRegistrationResponse({
      response: body.credential as RegistrationResponseJSON,
      expectedChallenge: pairing.challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo.userVerified) {
      await prisma.securityAuditEvent.create({
        data: { acao: "WEBAUTHN_ENROLLMENT", resultado: "failure", funcionarioId: pairing.funcionarioId, trustedDeviceId: pairing.trustedDeviceId, ipHash },
      });
      return NextResponse.json({ error: "Não foi possível concluir a verificação do aparelho." }, { status: 400 });
    }

    const credential = verification.registrationInfo.credential;
    const newDeviceToken = pairing.trustedDevice.tokenHash ? null : randomUUID() + randomUUID();
    const deviceTokenHash = pairing.trustedDevice.tokenHash ?? hashSecret(newDeviceToken!);
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.devicePairing.updateMany({
        where: {
          id: pairing.id,
          usadoEm: null,
          expiraEm: { gt: now },
          challenge: pairing.challenge,
          challengeExpiraEm: { gt: now },
        },
        data: { usadoEm: now, challenge: null, challengeExpiraEm: null },
      });
      if (consumed.count !== 1) throw new Error("PAIRING_ALREADY_USED");

      if (!pairing.trustedDevice.tokenHash) {
        const claimed = await transaction.trustedDevice.updateMany({
          where: { id: pairing.trustedDeviceId, tokenHash: null, revogadoEm: null },
          data: { tokenHash: deviceTokenHash, pareadoEm: now, ultimoAcessoEm: now },
        });
        if (claimed.count !== 1) throw new Error("DEVICE_ALREADY_PAIRED");
      } else {
        await transaction.trustedDevice.update({ where: { id: pairing.trustedDeviceId }, data: { ultimoAcessoEm: now } });
      }

      await transaction.webAuthnCredential.create({
        data: {
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: JSON.stringify(credential.transports ?? []),
          funcionarioId: pairing.funcionarioId,
          trustedDeviceId: pairing.trustedDeviceId,
          consentVersion: webauthnUserConsentVersion,
          consentAt: now,
          createdById: pairing.criadoPorId,
        },
      });
      await transaction.securityAuditEvent.create({
        data: {
          acao: "WEBAUTHN_ENROLLMENT",
          resultado: "success",
          funcionarioId: pairing.funcionarioId,
          atorId: pairing.criadoPorId,
          trustedDeviceId: pairing.trustedDeviceId,
          ipHash,
          detalhe: "Consentimento local WebAuthn registrado.",
        },
      });
    }, { isolationLevel: "Serializable" });

    const response = NextResponse.json({ message: "Aparelho pareado e autenticador cadastrado." }, { status: 201 });
    response.cookies.set(trustedDeviceCookieName, newDeviceToken ?? existingDeviceToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    const errorId = randomUUID();
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Este autenticador já está cadastrado neste aparelho." }, { status: 409 });
    console.error("Falha ao concluir pareamento WebAuthn", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível concluir o pareamento.", errorId }, { status: 500 });
  }
}