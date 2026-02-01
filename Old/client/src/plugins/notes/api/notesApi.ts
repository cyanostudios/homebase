class NotesApi {
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
    return this.request(`/notes/${id}`, { method: 'DELETE' });
  }
}

export const notesApi = new NotesApi();
