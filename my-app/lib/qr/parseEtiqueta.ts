export type ParseEtiquetaResult =
  | { ok: true; codigo: string }
  | { ok: false; motivo: string };

const clean = (value: string) => value
  .normalize("NFKC")
  .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF\u00AD]/g, " ")
  .trim();

function canonicalCode(value: string): string | null {
  const code = clean(value).replace(/\s+/g, "");
  return /^[0-9]{1,8}$/.test(code) ? code : null;
}

function codesFromStructuredPayload(value: string): string[] {
  const keys = new Set(["codigo", "cod", "id", "sku", "item", "produto"]);
  const found: string[] = [];
  const add = (candidate: unknown) => {
    if (typeof candidate !== "string" && typeof candidate !== "number") return;
    const code = canonicalCode(String(candidate));
    if (code) found.push(code);
  };

  try {
    const url = new URL(value);
    for (const [key, candidate] of url.searchParams) {
      if (keys.has(key.toLocaleLowerCase("pt-BR"))) add(candidate);
    }
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
    if (lastSegment) add(decodeURIComponent(lastSegment));
    if (found.length) return found;
  } catch {
    // Not a URL; continue with the supported text formats.
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      for (const [key, candidate] of Object.entries(parsed)) {
        if (keys.has(key.toLocaleLowerCase("pt-BR"))) add(candidate);
      }
      if (found.length) return found;
    }
  } catch {
    // Not JSON; continue with key/value and token formats.
  }

  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^\s*(codigo|cod|id|sku|item|produto)\s*[:=]\s*(.*?)\s*$/i);
    if (match) add(match[2]);
  }
  if (found.length) return found;

  const tokens = value.match(/[a-z0-9]+/gi) ?? [];
  for (const token of tokens) add(token);
  return found;
}

export function parseEtiqueta(raw: string): ParseEtiquetaResult {
  const value = clean(raw);
  if (!value) return { ok: false, motivo: "Etiqueta vazia." };
  if (value.length > 2048) return { ok: false, motivo: "Conteúdo da etiqueta muito longo." };

  const exact = canonicalCode(value);
  if (exact) return { ok: true, codigo: exact };

  const candidates = codesFromStructuredPayload(value);
  const unique = [...new Set(candidates)];
  if (unique.length === 1) return { ok: true, codigo: unique[0] };
  if (unique.length > 1) return { ok: false, motivo: "A etiqueta contém mais de um código possível." };
  return { ok: false, motivo: "Formato de etiqueta desconhecido." };
}

export function normalizarCodigoEtiqueta(codigo: string): string {
  const normalized = codigo.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}
