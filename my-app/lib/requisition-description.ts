import { decodeItemDescription, stripIdempotencyMetadata } from "./requisition-metadata";

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
