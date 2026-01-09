// Contacts API - V2 with CSRF protection
class ContactsApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('CSRF token fetch failed:', error);
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
      headers['X-CSRF-Token'] = await this.getCsrfToken();
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

  async getContacts() {
    return this.request('/contacts');
  }

  async createContact(contactData: any) {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  async updateContact(id: string, contactData: any) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
  }

  async deleteContact(id: string) {
    return this.request(`/contacts/${id}`, { method: 'DELETE' });
  }
}

export const contactsApi = new ContactsApi();
