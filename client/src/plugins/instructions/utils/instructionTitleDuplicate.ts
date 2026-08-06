/** Case-insensitive title uniqueness among instructions, optionally excluding one id. */

export function hasDuplicateInstructionTitle(
  instructions: Array<{ id: string; title: string }>,
  title: string,
  excludeId?: string | null,
): boolean {
  const titleKey = title.trim().toLowerCase();
  if (!titleKey) {
    return false;
  }
  return instructions.some(
    (row) =>
      String(row.id) !== String(excludeId ?? '') &&
      (row.title || '').trim().toLowerCase() === titleKey,
  );
}
