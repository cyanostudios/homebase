import { Estimate, EstimateShare, CreateShareRequest, PublicEstimate } from '../types/estimate';

// Estimates API - V2 with CSRF protection
class EstimatesApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSRF token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        if (response.status === 401) {
          throw new Error('Session required. Please log in again.');
        } else if (response.status === 503) {
          throw new Error('CSRF protection not configured on server');
        } else {
          throw new Error(`Failed to get CSRF token: ${errorData.error || response.statusText}`);
        }
      }
      
      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('CSRF token not found in response');
      }
      
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error: any) {
      console.error('CSRF token fetch failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get CSRF token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      // CSRF temporarily disabled: headers["X-CSRF-Token"] = await this.getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      
      // Handle standardized error format from backend
      const errorMessage = error.error || error.message || 'Request failed';
      const errorCode = error.code;
      const errorDetails = error.details;
      
      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;
      
      throw err;
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

  async bulkDelete(ids: string[]): Promise<{ ok: boolean; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/estimates/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async getNextEstimateNumber(): Promise<string> {
    const result = await this.request('/estimates/number/next');
    return result.estimateNumber;
  }

  // === FIXED PDF DOWNLOAD METHOD ===
  async downloadPDF(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/estimates/${id}/pdf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF';
        try {
          const text = await response.text();
          const match = text.match(/"error"\s*:\s*"([^"]+)"/);
          if (match) {
            errorMessage = match[1];
          }
        } catch (_err) {
          // ESLint no-empty: ignore parse errors when response body isn't JSON
        }
        throw new Error(errorMessage);
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'estimate.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"]+)\1/);
        if (match && match[2]) {
          filename = match[2];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
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
  async createShare(request: CreateShareRequest): Promise<EstimateShare> {
    return estimatesApi.createShare(request);
  },

  async getShares(estimateId: string): Promise<EstimateShare[]> {
    return estimatesApi.getShares(estimateId);
  },

  async revokeShare(shareId: string): Promise<void> {
    return estimatesApi.revokeShare(shareId);
  },

  async getPublicEstimate(token: string): Promise<PublicEstimate> {
    return estimatesApi.getPublicEstimate(token);
  },

  generateShareUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/estimate/${token}`;
  },
};
