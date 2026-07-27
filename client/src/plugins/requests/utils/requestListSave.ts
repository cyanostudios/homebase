import type { RequestPayload } from '../api/requestsApi';
import type { Request, RequestPriority, RequestStatus } from '../types/requests';

/**
 * Whether a successful update should sync the open panel (current request, mode).
 * List inline saves of a *different* request must not force the open panel to view.
 */
export function shouldApplyOpenRequestSaveEffects(
  currentRequestId: string | null | undefined,
  updatedRequestId: string,
): boolean {
  if (currentRequestId === null || currentRequestId === undefined || currentRequestId === '') {
    return false;
  }
  return String(currentRequestId) === String(updatedRequestId);
}

/** Minimal payload for immediate list status changes via saveRequest (matches RequestView). */
export function buildRequestListStatusSavePayload(
  request: Pick<Request, 'title'>,
  newStatus: RequestStatus,
): RequestPayload {
  return {
    title: request.title,
    status: newStatus,
  };
}

/** Minimal payload for immediate list priority changes via saveRequest (matches RequestView). */
export function buildRequestListPrioritySavePayload(
  request: Pick<Request, 'title'>,
  newPriority: RequestPriority,
): RequestPayload {
  return {
    title: request.title,
    priority: newPriority,
  };
}
