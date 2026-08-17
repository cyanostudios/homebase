import { useCallback, useEffect, useState } from 'react';

import type { ApiRequestError } from '@/core/api/createApiClient';

import { teamsApi, type TeamVenuePayload } from '../api/teamsApi';
import type { TeamVenue } from '../types/teams';

let cachedVenues: TeamVenue[] | null = null;
let inFlight: Promise<TeamVenue[]> | null = null;
const listeners = new Set<(venues: TeamVenue[]) => void>();

function sortVenues(rows: TeamVenue[]): TeamVenue[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function setCache(rows: TeamVenue[]) {
  cachedVenues = sortVenues(rows);
  listeners.forEach((listener) => listener(cachedVenues ?? []));
}

function loadVenues(force = false): Promise<TeamVenue[]> {
  if (!force && cachedVenues) {
    return Promise.resolve(cachedVenues);
  }
  if (inFlight) {
    return inFlight;
  }
  inFlight = teamsApi
    .getVenues()
    .then((rows) => {
      setCache(rows);
      inFlight = null;
      return cachedVenues ?? [];
    })
    .catch((error) => {
      inFlight = null;
      throw error;
    });
  return inFlight;
}

function isDuplicateNameError(error: unknown): boolean {
  const err = error as ApiRequestError;
  if (err?.status === 409 || err?.code === 'CONFLICT') {
    return true;
  }
  const details = err?.details;
  if (!Array.isArray(details)) {
    return false;
  }
  return details.some(
    (item) => item && typeof item === 'object' && (item as { field?: string }).field === 'name',
  );
}

export function useTeamVenues() {
  const [venues, setVenues] = useState<TeamVenue[]>(cachedVenues ?? []);
  const [isLoading, setIsLoading] = useState(!cachedVenues);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const listener = (next: TeamVenue[]) => setVenues(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(async (force = false) => {
    if (force) {
      setIsLoading(true);
    }
    try {
      const rows = await loadVenues(force);
      setLoadError(false);
      setVenues(rows);
      return rows;
    } catch {
      setLoadError(true);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(true);
  }, [reload]);

  const createVenue = useCallback(async (payload: TeamVenuePayload) => {
    try {
      const created = await teamsApi.createVenue(payload);
      setCache([...(cachedVenues ?? []), created]);
      return { ok: true as const, venue: created };
    } catch (error) {
      return { ok: false as const, duplicate: isDuplicateNameError(error) };
    }
  }, []);

  const updateVenue = useCallback(async (id: string, payload: TeamVenuePayload) => {
    try {
      const updated = await teamsApi.updateVenue(id, payload);
      setCache((cachedVenues ?? []).map((venue) => (venue.id === id ? updated : venue)));
      return { ok: true as const, venue: updated };
    } catch (error) {
      return { ok: false as const, duplicate: isDuplicateNameError(error) };
    }
  }, []);

  const deleteVenue = useCallback(async (id: string) => {
    try {
      await teamsApi.deleteVenue(id);
      setCache((cachedVenues ?? []).filter((venue) => venue.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    venues,
    isLoading,
    loadError,
    reload,
    createVenue,
    updateVenue,
    deleteVenue,
  };
}
