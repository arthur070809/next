import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY is not configured.");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

export function encryptSecuritySecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function decryptSecuritySecret(ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]).toString("utf8");
}