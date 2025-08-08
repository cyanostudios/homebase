// client/src/plugins/rail/api/railApi.ts
export interface RailStation {
    code: string;
    name: string;
    shortName?: string;
    country?: string;
    countyNo?: number;
    modified?: string;
  }
  
  class RailApi {
    async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
      const res = await fetch(`/api/rail${endpoint}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
        ...init,
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try {
          const j = await res.json();
          msg = j?.error || msg;
        } catch {}
        throw new Error(msg);
      }
      return res.json() as Promise<T>;
    }
  
    // Stations (cachas 24h i backend). force=1 för att tvinga refresh.
    async getStations(force = false): Promise<{ count: number; stations: RailStation[] }> {
        const q = force ? '?force=1' : '';
        return this.request<{ count: number; stations: RailStation[] }>(`/stations${q}`);
      }
      
  
    // Realtime departures/arrivals
    async getAnnouncements(stationCode: string) {
      const url = `/announcements?station=${encodeURIComponent(stationCode)}`;
      return this.request<{ station: string; announcements: any[] }>(url);
    }
  }
  
  export const railApi = new RailApi();
  