export interface Note {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  createdAt: Date;
  updatedAt: Date;
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