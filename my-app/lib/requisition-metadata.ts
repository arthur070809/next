export type SetorRequisicao = "setor1" | "setor2" | "setor3";

const sectorPrefix = /^\[\[setor:v1:(setor1|setor2|setor3)\]\]\n?/;

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
