import { decodeItemDescription, stripIdempotencyMetadata } from "./requisition-metadata";

export const DESCRIPTION_MAX_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH_ERROR =
  `A descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`;

export function normalizeRequisitionDescription(value: string) {
  return value.replace(/\r\n?|\n/g, " ").trim();
}

export function limitRequisitionDescriptionInput(value: string) {
  return Array.from(value.replace(/\r\n?|\n/g, " "))
    .slice(0, DESCRIPTION_MAX_LENGTH)
    .join("");
}

export function resolveRequisitionItemMetadata(
  itemDescription: string | null | undefined,
  requestObservation: string | null | undefined,
  useLegacyFallback: boolean,
) {
  const itemMetadata = decodeItemDescription(itemDescription);
  if (itemMetadata.descricao || !useLegacyFallback) return itemMetadata;

  const legacyMetadata = decodeItemDescription(stripIdempotencyMetadata(requestObservation));
  return {
    setor: itemMetadata.setor ?? legacyMetadata.setor,
    descricao: legacyMetadata.descricao,
  };
}
