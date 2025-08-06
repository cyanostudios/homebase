// Import API functions
export const importApi = {
    // Get available import templates
    async getTemplates() {
      const response = await fetch('/api/import/templates', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Failed to get templates');
      }
      
      return response.json();
    },
  
    // Preview CSV file before import
    async previewCsv(file: File, pluginType: string = 'contacts') {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('pluginType', pluginType);
      
      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Failed to preview CSV');
      }
      
      return response.json();
    },
  
    // Validate CSV data without importing
    async validateCsv(file: File, pluginType: string = 'contacts') {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('pluginType', pluginType);
      
      const response = await fetch('/api/import/validate', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Failed to validate CSV');
      }
      
      return response.json();
    },
  
    // Import CSV data
    async importCsv(file: File, pluginType: string = 'contacts', skipValidation: boolean = false) {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('pluginType', pluginType);
      formData.append('skipValidation', skipValidation.toString());
      
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Failed to import CSV');
      }
      
      return response.json();
    }
  };