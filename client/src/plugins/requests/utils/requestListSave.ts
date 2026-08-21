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

/**
 * Minimal payload for immediate assignee changes via saveRequest.
 * The backend preserves all other fields when omitted from the payload, so unlike Tasks
 * (whose model always requires the full record) Requests only need to send what changed.
 */
export function buildRequestAssigneesSavePayload(
  request: Pick<Request, 'title'>,
  assignedToIds: string[],
): RequestPayload {
  return {
    title: request.title,
    assigned_to_ids: assignedToIds.map(String),
  };
}

/** Minimal payload for immediate assigned-team changes via saveRequest. */
export function buildRequestTeamSavePayload(
  request: Pick<Request, 'title'>,
  teamId: string | null,
): RequestPayload {
  return {
    title: request.title,
    team_id: teamId ? Number(teamId) : null,
  };
}
