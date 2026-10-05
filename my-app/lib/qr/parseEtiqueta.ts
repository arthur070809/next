export type ParseEtiquetaResult =
  | { ok: true; codigo: string }
  | { ok: false; motivo: string };

/**
 * Accepts the confirmed label format (the ERP/TOTVS code only); expand here if
 * the encoded QR payload format changes, keeping callers independent of it.
 */
export function parseEtiqueta(raw: string): ParseEtiquetaResult {
  const codigo = raw
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\r\n]/g, "")
    .trim();

  if (!codigo) return { ok: false, motivo: "Etiqueta vazia." };
  if (codigo.length > 32) return { ok: false, motivo: "Conteúdo da etiqueta muito longo." };
  if (!/^[0-9]{1,8}$/.test(codigo)) {
    return { ok: false, motivo: "A etiqueta deve conter somente de 1 a 8 dígitos." };
  }

  return { ok: true, codigo };
}

export function normalizarCodigoEtiqueta(codigo: string): string {
  const normalized = codigo.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}
