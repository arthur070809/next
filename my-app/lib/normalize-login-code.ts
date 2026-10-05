export function normalizeLoginCode(value: string) {
  return value.normalize("NFKC").trim().toUpperCase();
}
