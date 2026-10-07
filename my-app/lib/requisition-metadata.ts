export type SetorRequisicao = "setor1" | "setor2" | "setor3";

const sectorPrefix = /^\[\[setor:v1:(setor1|setor2|setor3)\]\]\n?/;
const idempotencyMarker = /\[\[idem:v1:[a-f0-9]{64}:[a-f0-9]{64}\]\]/gi;

export function idempotencyMarkerPrefix(keyHash: string): string {
  return `[[idem:v1:${keyHash}:`;
}

export function createIdempotencyMarker(keyHash: string, payloadHash: string): string {
  return `${idempotencyMarkerPrefix(keyHash)}${payloadHash}]]`;
}

export function encodeIdempotencyMetadata(
  observation: string | undefined,
  keyHash: string,
  payloadHash: string,
): string {
  const marker = createIdempotencyMarker(keyHash, payloadHash);
  const cleanObservation = observation?.trim() ?? "";
  return cleanObservation ? `${marker}\n${cleanObservation}` : marker;
}

export function encodeItemDescription(description: string | undefined, setor?: SetorRequisicao): string | null {
  const cleanDescription = description?.trim() ?? "";
  if (!setor) return cleanDescription || null;
  return `[[setor:v1:${setor}]]${cleanDescription ? `\n${cleanDescription}` : ""}`;
}

export function decodeItemDescription(value: string | null | undefined): {
  setor: SetorRequisicao | null;
  descricao: string;
} {
  const match = value?.match(sectorPrefix);
  const descricao = value?.replace(sectorPrefix, "").replace(idempotencyMarker, "").trim() ?? "";
  return {
    setor: match ? match[1] as SetorRequisicao : null,
    descricao,
  };
}

export function stripIdempotencyMetadata(value: string | null | undefined): string | null {
  const cleanValue = value
    ?.replace(idempotencyMarker, "")
    .replace(/\r?\n[ \t]*(\|)/g, " $1")
    .trim();
  return cleanValue || null;
}
