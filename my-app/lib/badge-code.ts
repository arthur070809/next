export const BADGE_PATTERN = /^\d{4,10}$/;

export function normalizeBadgeCode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function isValidBadgeCode(value: string) {
  return BADGE_PATTERN.test(normalizeBadgeCode(value));
}

export function advanceFromBadgeFieldOnEnter(
  event: { key: string; preventDefault: () => void },
  nextField: { focus: () => void } | null,
) {
  if (event.key !== "Enter") return false;
  event.preventDefault();
  nextField?.focus();
  return true;
}
