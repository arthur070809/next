import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getLoginClientIpHash } from "@/lib/login-attempts";
import { createIdentifyFaceChallenge } from "@/lib/login-flow";
import { isFaceLoginEnabled } from "@/lib/facial/config";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  try {
    if (!isFaceLoginEnabled()) {
      return NextResponse.json({ error: "Reconhecimento facial desativado." }, { status: 404 });
    }
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const ipHash = getLoginClientIpHash(request);
    return NextResponse.json(await createIdentifyFaceChallenge(ipHash), { status: 202 });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao iniciar identificação facial por rosto", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível iniciar a identificação facial.", errorId }, { status: 500 });
  }
}
