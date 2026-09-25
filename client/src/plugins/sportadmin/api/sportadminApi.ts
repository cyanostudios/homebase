// client/src/plugins/sportadmin/api/sportadminApi.ts
import { createApiClient } from '@/core/api/createApiClient';

import type {
  SportadminDiscovery,
  SportadminMatchItem,
  SportadminNewsItem,
  SportadminPageItem,
  SportadminStatus,
  SportadminSyncError,
  SportadminTeamItem,
} from '../types/sportadmin';

class SportadminApi {
  private request = createApiClient('/sportadmin', {
    jsonOnMutationsOnly: true,
    emptyBodyAsNull: true,
  });

  async getStatus(): Promise<SportadminStatus> {
    return this.request('') as Promise<SportadminStatus>;
  }

  async saveConfig(siteUrl: string): Promise<SportadminStatus> {
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify({ siteUrl }),
    }) as Promise<SportadminStatus>;
  }

  async syncNow(): Promise<SportadminStatus> {
    return this.request('/sync', { method: 'POST' }) as Promise<SportadminStatus>;
  }

  async setCronEnabled(cronEnabled: boolean): Promise<SportadminStatus> {
    return this.request('/cron-settings', {
      method: 'POST',
      body: JSON.stringify({ cronEnabled }),
    }) as Promise<SportadminStatus>;
  }

  async getErrors(): Promise<SportadminSyncError[]> {
    return this.request('/errors') as Promise<SportadminSyncError[]>;
  }

  async getDiscovery(): Promise<SportadminDiscovery> {
    return this.request('/discovery') as Promise<SportadminDiscovery>;
  }

  async getNews(limit = 5): Promise<SportadminNewsItem[]> {
    return this.request(`/news?limit=${limit}`) as Promise<SportadminNewsItem[]>;
  }

  async getMatches(params?: {
    upcoming?: boolean;
    team?: string;
    category?: string;
  }): Promise<SportadminMatchItem[]> {
    const q = new URLSearchParams();
    if (params?.upcoming) {
      q.set('upcoming', 'true');
    }
    if (params?.team) {
      q.set('team', params.team);
    }
    if (params?.category) {
      q.set('category', params.category);
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/matches${suffix}`) as Promise<SportadminMatchItem[]>;
  }

  async getPages(): Promise<SportadminPageItem[]> {
    return this.request('/pages') as Promise<SportadminPageItem[]>;
  }

  async getTeams(): Promise<SportadminTeamItem[]> {
    return this.request('/teams') as Promise<SportadminTeamItem[]>;
  }
}

export const sportadminApi = new SportadminApi();
