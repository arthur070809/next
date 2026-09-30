import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => error ? reject(error) : resolve(key as Buffer))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltHex, keyHex] = encoded.split(":")
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false
  const salt = Buffer.from(saltHex, "hex")
  const expected = Buffer.from(keyHex, "hex")
  if (salt.length !== 16 || expected.length !== 64) return false
  const actual = await derive(password, salt)
  return timingSafeEqual(actual, expected)
}
