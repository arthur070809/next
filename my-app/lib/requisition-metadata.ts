export type SetorRequisicao = "setor1" | "setor2" | "setor3";

const sectorPrefix = /^\[\[setor:v1:(setor1|setor2|setor3)\]\]\n?/;
const idempotencyMarker = /\[\[idem:v1:[a-f0-9]{64}:[a-f0-9]{64}\]\]/gi;

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
  return {
    setor: match ? match[1] as SetorRequisicao : null,
    descricao: value?.replace(sectorPrefix, "") ?? "",
  };
}

export function stripIdempotencyMetadata(value: string | null | undefined): string | null {
  const cleanValue = value
    ?.replace(idempotencyMarker, "")
    .replace(/\r?\n[ \t]*(\|)/g, " $1")
    .trim();
  return cleanValue || null;
}
