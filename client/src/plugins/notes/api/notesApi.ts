import { apiFetch } from '@/core/api/apiFetch';

import type { CreateNoteShareRequest, NoteShare, PublicNote } from '../types/notes';

class NotesApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await apiFetch(`/api${endpoint}`, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));

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

  async createShare(request: CreateNoteShareRequest): Promise<NoteShare> {
    const share = await this.request('/notes/shares', {
      method: 'POST',
      body: JSON.stringify({
        noteId: request.noteId,
        validUntil: request.validUntil.toISOString(),
      }),
    });
    return {
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    };
  }

  async getShares(noteId: string): Promise<NoteShare[]> {
    const shares = await this.request(`/notes/${noteId}/shares`);
    return shares.map((share: any) => ({
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    }));
  }

  async revokeShare(shareId: string): Promise<void> {
    await this.request(`/notes/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async getPublicNote(token: string): Promise<PublicNote> {
    const note = await this.request(`/notes/public/${token}`);
    return {
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt),
      shareValidUntil: new Date(note.shareValidUntil),
    };
  }
}

export const notesApi = new NotesApi();

export const noteShareApi = {
  async createShare(request: CreateNoteShareRequest): Promise<NoteShare> {
    return notesApi.createShare(request);
  },
  async getShares(noteId: string): Promise<NoteShare[]> {
    return notesApi.getShares(noteId);
  },
  async revokeShare(shareId: string): Promise<void> {
    return notesApi.revokeShare(shareId);
  },
  async getPublicNote(token: string): Promise<PublicNote> {
    return notesApi.getPublicNote(token);
  },
  generateShareUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/note/${token}`;
  },
};
