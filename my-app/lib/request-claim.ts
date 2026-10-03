export type ClaimResolution =
  | { type: "claimed" }
  | { type: "already-claimed"; attendantName: string | null }
  | { type: "not-available"; status: string }
  | { type: "not-found" };

export function resolveClaimResult(
  updatedCount: number,
  latest: { status: string; attendantName: string | null } | null,
): ClaimResolution {
  if (updatedCount === 1) return { type: "claimed" };
  if (!latest) return { type: "not-found" };
  if (latest.status !== "ASSUMIDA") return { type: "not-available", status: latest.status };
  return { type: "already-claimed", attendantName: latest.attendantName };
}
