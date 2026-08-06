/**
 * Formats provider validationErrors for the instructions list status control.
 * Covers publish-without-steps (`steps`) and API failures (`general`).
 */
export function getInstructionListStatusErrorMessage(
  validationErrors: Array<{ field: string; message: string }>,
): string | null {
  if (!validationErrors.length) {
    return null;
  }
  return validationErrors.map((e) => e.message).join(' ');
}
