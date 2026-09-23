/**
 * Resolve whether/how to seed the email body when BulkEmailDialog opens.
 * - On closed → open: always seed (empty string if no initialBody).
 * - While open: only fill when body is still empty and a non-empty initialBody arrived late.
 * - Returns undefined when the body should not be changed.
 */
export function resolveBodyOnDialogOpen(
  wasOpen: boolean,
  isOpen: boolean,
  initialBody: string | undefined,
  currentBody = '',
): string | undefined {
  if (!isOpen) {
    return undefined;
  }
  const seed = typeof initialBody === 'string' ? initialBody : '';
  if (!wasOpen) {
    return seed;
  }
  if (currentBody === '' && seed !== '') {
    return seed;
  }
  return undefined;
}
