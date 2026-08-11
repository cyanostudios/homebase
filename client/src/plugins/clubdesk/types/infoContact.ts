export interface ClubdeskInfoContactRef {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  displayName: string;
}

export interface ClubdeskInfoContact {
  id: string;
  contactId: string;
  blurb: string;
  sortOrder: number;
  contact: ClubdeskInfoContactRef;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ClubdeskInfoContactPayload = {
  contactId: string;
  blurb?: string;
};
