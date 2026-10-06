import { describe, expect, it } from "vitest";
import {
  createIdempotencyMarker,
  decodeItemDescription,
  encodeIdempotencyMetadata,
  encodeItemDescription,
  idempotencyMarkerPrefix,
  stripIdempotencyMetadata,
} from "./requisition-metadata";

describe("request item metadata", () => {
  it("round-trips sector metadata without changing the user's description", () => {
    const encoded = encodeItemDescription("Bancada de montagem", "setor2");

    expect(decodeItemDescription(encoded)).toEqual({
      setor: "setor2",
      descricao: "Bancada de montagem",
    });
  });

  it("keeps old descriptions without a sector marker readable", () => {
    expect(decodeItemDescription("Uso na linha A")).toEqual({
      setor: null,
      descricao: "Uso na linha A",
    });
  });

  it("does not expose internal idempotency markers as user observations", () => {
    const marker = `[[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]`;

    expect(stripIdempotencyMetadata(`Pedido do operador\n${marker} | Motivo anulação: ajuste`))
      .toBe("Pedido do operador | Motivo anulação: ajuste");
    expect(stripIdempotencyMetadata(marker)).toBeNull();
  });

  it("uses shared idempotency helpers to encode and find markers", () => {
    const keyHash = "a".repeat(64);
    const payloadHash = "b".repeat(64);
    const marker = createIdempotencyMarker(keyHash, payloadHash);
    const encoded = encodeIdempotencyMetadata("Observação da demonstração", keyHash, payloadHash);

    expect(marker).toBe(`[[idem:v1:${keyHash}:${payloadHash}]]`);
    expect(idempotencyMarkerPrefix(keyHash)).toBe(`[[idem:v1:${keyHash}:`);
    expect(encoded).toBe(`${marker}\nObservação da demonstração`);
    expect(stripIdempotencyMetadata(encoded)).toBe("Observação da demonstração");
  });
});
