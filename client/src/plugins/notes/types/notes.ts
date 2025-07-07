export interface Note {
  id: string;
  title: string;
  content: string;
  mentions: NoteMention[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position: number; // Character position in content where mention starts
  length: number;   // Length of the mention text
}

export interface NoteFormValues {
  title: string;
  content: string;
}