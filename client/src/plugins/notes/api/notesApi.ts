import { createApiClient } from '@/core/api/createApiClient';

import type { CreateNoteShareRequest, NoteShare, PublicNote } from '../types/notes';

class NotesApi {
  private request = createApiClient('/notes');

  async getNotes() {
    return this.request('');
  }

  async createNote(noteData: any) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async updateNote(id: string, noteData: any) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(id: string) {
    return this.request(`/${id}`, {
      method: 'DELETE',
    });
  }

  async createShare(request: CreateNoteShareRequest): Promise<NoteShare> {
    const share = (await this.request('/shares', {
      method: 'POST',
      body: JSON.stringify({
        noteId: request.noteId,
        validUntil: request.validUntil.toISOString(),
      }),
    })) as NoteShare & { validUntil: string; createdAt: string; lastAccessedAt?: string };
    return {
      ...share,
      validUntil: new Date(share.validUntil),
      createdAt: new Date(share.createdAt),
      lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
    };
  }

  async getShares(noteId: string): Promise<NoteShare[]> {
    const shares = (await this.request(`/${noteId}/shares`)) as Array<
      NoteShare & { validUntil: string; createdAt: string; lastAccessedAt?: string }
    >;
    return shares.map((share) => ({
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

  async getPublicNote(token: string): Promise<PublicNote> {
    const note = (await this.request(`/public/${token}`)) as PublicNote & {
      createdAt: string;
      updatedAt: string;
      shareValidUntil: string;
    };
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
