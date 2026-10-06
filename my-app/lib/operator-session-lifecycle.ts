export const OPERATOR_RETURN_GRACE_MS = 60_000;

export function shouldEndOperatorSessionOnReturn(
  role: string,
  hiddenAt: number | null,
  now: number,
  scannerActive: boolean,
): boolean {
  return role === "operador"
    && hiddenAt !== null
    && Number.isFinite(hiddenAt)
    && Number.isFinite(now)
    && now - hiddenAt >= OPERATOR_RETURN_GRACE_MS
    && !scannerActive;
}

export function shouldSendOperatorPagehideLogout(
  role: string,
  scannerActive: boolean,
  persisted: boolean,
): boolean {
  return role === "operador" && !scannerActive && !persisted;
}
