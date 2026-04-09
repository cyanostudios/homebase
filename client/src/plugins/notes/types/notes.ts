export interface Note {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  createdAt: Date;
  updatedAt: Date;
}

/** Active share link metadata (API: /api/notes/:id/shares) */
export interface NoteShare {
  id: string;
  noteId: string;
  shareToken: string;
  validUntil: Date;
  createdAt: Date;
  accessedCount: number;
  lastAccessedAt?: Date;
}

export interface CreateNoteShareRequest {
  noteId: string;
  validUntil: Date;
}

/** Note loaded via public share token (includes share expiry metadata) */
export interface PublicNote extends Note {
  shareValidUntil: Date;
  accessedCount: number;
}

export interface Mention {
  contactId: string;
  contactName: string;
  companyName: string;
  position: number;
  length: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
