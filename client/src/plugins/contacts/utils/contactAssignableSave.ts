/** Payload for updating assignable flag on an existing contact. */
export function buildContactAssignableSavePayload<T extends { isAssignable?: boolean }>(
  contact: T,
  isAssignable: boolean,
): T & { isAssignable: boolean } {
  return { ...contact, isAssignable };
}
