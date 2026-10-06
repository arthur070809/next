import { createHash } from "node:crypto";

function uuidFromHash(value: string) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createDepositOperationIdentity(
  funcionarioId: number,
  idempotencyKey: string,
  action: string,
  payload: unknown,
) {
  const keyHash = createHash("sha256")
    .update(`${funcionarioId}:${idempotencyKey}`)
    .digest("hex");
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return {
    movementId: uuidFromHash(`deposit:${action}:${keyHash}`),
    marker: `[[deposit-op:v1:${keyHash}:${payloadHash}]]`,
  };
}
