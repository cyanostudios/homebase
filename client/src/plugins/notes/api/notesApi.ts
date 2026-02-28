// Notes API - V2 with CSRF protection
class NotesApi {
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
        
        // More specific error message
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
      // Re-throw with original message if it's already an Error
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
      headers["X-CSRF-Token"] = await this.getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
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

  async getNotes() {
    return this.request('/notes');
  }

  async createNote(noteData: any) {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async updateNote(id: string, noteData: any) {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(id: string) {
    return this.request(`/notes/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkDelete(ids: string[]): Promise<{ ok: boolean; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/notes/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }
}

export const notesApi = new NotesApi();
