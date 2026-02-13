/**
 * Minimal type for a @mention of a contact in rich text.
 * Used by core MentionTextarea and MentionContent; plugins store this shape (e.g. note.mentions, task.mentions).
 */
export interface Mention {
  contactId: string;
  contactName: string;
  position: number;
  length: number;
  companyName?: string;
}
