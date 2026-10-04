export type RessuprimentoAccess =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 };

export function autorizarRessuprimento(
  funcionario: { role: string } | null,
): RessuprimentoAccess {
  if (!funcionario) return { allowed: false, status: 401 };
  if (funcionario.role !== "admin") return { allowed: false, status: 403 };
  return { allowed: true };
}
