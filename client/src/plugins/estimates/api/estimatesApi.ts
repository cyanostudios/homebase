import { apiFetch } from '@/core/api/apiFetch';
import { createApiClient } from '@/core/api/createApiClient';

import { Estimate, EstimateShare, CreateShareRequest, PublicEstimate } from '../types/estimate';

// Estimates API — mutating calls use apiFetch (CSRF when ENABLE_CSRF=true on server)
class EstimatesApi {
  private request = createApiClient('/estimates');

  async getEstimates(): Promise<Estimate[]> {
    const estimates = (await this.request('')) as any[];
    return estimates.map((estimate: any) => ({
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    }));
  }

  async getEstimate(id: string): Promise<Estimate> {
    const estimate = (await this.request(`/${id}`)) as any;
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async createEstimate(estimateData: any): Promise<Estimate> {
    const estimate = (await this.request('', {
      method: 'POST',
      body: JSON.stringify(estimateData),
    })) as any;
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async updateEstimate(id: string, estimateData: any): Promise<Estimate> {
    const estimate = (await this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(estimateData),
    })) as any;
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
    };
  }

  async deleteEstimate(id: string): Promise<void> {
    await this.request(`/${id}`, {
      method: 'DELETE',
    });
  }

  async getNextEstimateNumber(): Promise<string> {
    const result = await this.request('/number/next');
    return result.estimateNumber;
  }

  async convertToInvoice(
    id: string,
  ): Promise<{ estimate: Estimate; invoice: { id: string; invoiceNumber?: string } }> {
    const response = await apiFetch(`/api/estimates/${id}/convert-to-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err: Error & { status?: number; existingInvoiceId?: string } = new Error(
        payload?.error || 'Failed to convert estimate to invoice',
      );
      err.status = response.status;
      if (payload?.existingInvoiceId) {
        err.existingInvoiceId = String(payload.existingInvoiceId);
      }
      throw err;
    }
    const estimate = payload.estimate;
    return {
      estimate: {
        ...estimate,
        validTo: new Date(estimate.validTo),
        createdAt: new Date(estimate.createdAt),
        updatedAt: new Date(estimate.updatedAt),
      },
      invoice: payload.invoice,
    };
  }

  // === FIXED PDF DOWNLOAD METHOD ===
  async downloadPDF(id: string): Promise<void> {
    try {
      const response = await apiFetch(`/api/estimates/${id}/pdf`, {
        method: 'GET',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF';
        try {
          const text = await response.text();
          const match = text.match(/"error"\s*:\s*"([^"]+)"/);
          if (match) {
            errorMessage = match[1];
          }
        } catch {
          // Ignore parse errors when response body isn't JSON
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
    const share = await this.request('/shares', {
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
    const shares = await this.request(`/${estimateId}/shares`);
    return shares.map((share: any) => ({
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    }));
  }

  async revokeShare(shareId: string): Promise<void> {
    await this.request(`/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async getPublicEstimate(token: string): Promise<PublicEstimate> {
    const response = await fetch(`/api/estimates/public/${token}`, { method: 'GET' });
    const estimate = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      throw new Error(estimate?.error || 'Failed to load estimate');
    }
    return {
      ...estimate,
      validTo: new Date(estimate.validTo),
      createdAt: new Date(estimate.createdAt),
      updatedAt: new Date(estimate.updatedAt),
      shareValidUntil: new Date(estimate.shareValidUntil),
    };
  }

  async downloadPublicPdf(token: string): Promise<Blob> {
    const response = await fetch(`/api/estimates/public/${token}/pdf`, { method: 'GET' });
    if (!response.ok) {
      let errorMessage = 'Failed to download PDF';
      try {
        const text = await response.text();
        const match = text.match(/"error"\s*:\s*"([^"]+)"/);
        if (match) {
          errorMessage = match[1];
        }
      } catch {
        // Ignore parse errors when response body isn't JSON
      }
      const err: any = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Blob([arrayBuffer], { type: 'application/pdf' });
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

  async downloadPublicPdf(token: string): Promise<Blob> {
    return estimatesApi.downloadPublicPdf(token);
  },

  generateShareUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/estimate/${token}`;
  },
};
