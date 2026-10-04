export function escaparCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replaceAll('"', '""')}"`;
}
