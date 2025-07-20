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
  
    async getEstimates() {
      return this.request('/estimates');
    }
  
    async createEstimate(estimateData: any) {
      return this.request('/estimates', {
        method: 'POST',
        body: JSON.stringify(estimateData),
      });
    }
  
    async updateEstimate(id: string, estimateData: any) {
      return this.request(`/estimates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(estimateData),
      });
    }
  
    async deleteEstimate(id: string) {
      return this.request(`/estimates/${id}`, { method: 'DELETE' });
    }
  
    async getNextEstimateNumber() {
      return this.request('/estimates/next-number');
    }
  }
  
  export const estimatesApi = new EstimatesApi();