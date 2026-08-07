/**
 * Formats provider validationErrors for the clubdesk list status control.
 * Covers publish-without-steps (`steps`) and API failures (`general`).
 */
export function getClubdeskListStatusErrorMessage(
  validationErrors: Array<{ field: string; message: string }>,
): string | null {
  if (!validationErrors.length) {
    return null;
  }
  return validationErrors.map((e) => e.message).join(' ');
}
