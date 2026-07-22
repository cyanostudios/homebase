import { createApiClient } from '@/core/api/createApiClient';

import type { PlaceResolved } from '../types/guides';

const request = createApiClient('/places');

export interface PlacesSearchResponse {
  provider: string;
  attribution: string | null;
  results: PlaceResolved[];
}

class PlacesApi {
  search(query: string, options?: { limit?: number; language?: string; countryCode?: string }) {
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.language) params.set('language', options.language);
    if (options?.countryCode) params.set('countryCode', options.countryCode);
    return request(`/search?${params.toString()}`) as Promise<PlacesSearchResponse>;
  }
}

export const placesApi = new PlacesApi();
