import { Estimate, EstimateShare, CreateShareRequest, PublicEstimate } from '../types/estimate';

// Regular estimate API functions using existing pattern
class EstimatesApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getEstimates(): Promise<Estimate[]> {
    const estimates = await this.request('/estimates');
    return estimates.map((estimate: any) => ({
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    }));
  }

  async getEstimate(id: string): Promise<Estimate> {
    const estimate = await this.request(`/estimates/${id}`);
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async createEstimate(estimateData: any): Promise<Estimate> {
    const estimate = await this.request('/estimates', {
      method: 'POST',
      body: JSON.stringify(estimateData),
    });
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async updateEstimate(id: string, estimateData: any): Promise<Estimate> {
    const estimate = await this.request(`/estimates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(estimateData),
    });
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async deleteEstimate(id: string): Promise<void> {
    await this.request(`/estimates/${id}`, {
      method: 'DELETE',
    });
  }

  async getNextEstimateNumber(): Promise<string> {
    const result = await this.request('/estimates/number/next');
    return result.estimateNumber;
  }

  // Sharing API functions
  async createShare(request: CreateShareRequest): Promise<EstimateShare> {
    const share = await this.request('/estimates/shares', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return {
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    };
  }

  async getShares(estimateId: string): Promise<EstimateShare[]> {
    const shares = await this.request(`/estimates/${estimateId}/shares`);
    return shares.map((share: any) => ({
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    }));
  }

  async revokeShare(shareId: string): Promise<void> {
    await this.request(`/estimates/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async getPublicEstimate(token: string): Promise<PublicEstimate> {
    const estimate = await this.request(`/estimates/public/${token}`);
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
      shareValidUntil: new Date(estimate.shareValidUntil),
    };
  }
}

export const estimatesApi = new EstimatesApi();

// Sharing API utilities
export const estimateShareApi = {
  // Create a share link
  async createShare(request: CreateShareRequest): Promise<EstimateShare> {
    return estimatesApi.createShare(request);
  },

  // Get all shares for an estimate
  async getShares(estimateId: string): Promise<EstimateShare[]> {
    return estimatesApi.getShares(estimateId);
  },

  // Revoke a share
  async revokeShare(shareId: string): Promise<void> {
    return estimatesApi.revokeShare(shareId);
  },

  // Get public estimate (no auth required)
  async getPublicEstimate(token: string): Promise<PublicEstimate> {
    return estimatesApi.getPublicEstimate(token);
  },

  // Generate share URL
  generateShareUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/estimate/${token}`;
  },
};