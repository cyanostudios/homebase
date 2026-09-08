// client/src/plugins/files/api/cloudStorageApi.ts
import { createApiClient } from '@/core/api/createApiClient';

/** Only Google Drive is wired to StorageProviderRegistry. */
export type CloudStorageService = 'googledrive';

export interface CloudStorageSettings {
  id: string;
  userId: string;
  connected: boolean;
  hasCustomCredentials?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ApiFieldError = { field: string; message: string };

class CloudStorageApi {
  private request = createApiClient('/files');

  async getSettings(service: CloudStorageService): Promise<CloudStorageSettings | null> {
    return this.request(`/cloud/${service}/settings`);
  }

  async startAuth(service: CloudStorageService): Promise<{ authUrl: string; state: string }> {
    return this.request(`/cloud/${service}/auth/start`);
  }

  async disconnect(service: CloudStorageService): Promise<{ ok: boolean; message: string }> {
    return this.request(`/cloud/${service}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async saveOAuthCredentials(
    service: CloudStorageService,
    clientId: string,
    clientSecret: string,
  ): Promise<{ ok: boolean; message: string }> {
    return this.request(`/cloud/${service}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret }),
    });
  }

  async getEmbedUrl(service: CloudStorageService): Promise<{ embedUrl: string; service: string }> {
    return this.request(`/cloud/${service}/embed`);
  }
}

export const cloudStorageApi = new CloudStorageApi();
