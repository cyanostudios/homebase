export interface InspectionFile {
  id: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
  url?: string | null;
  linkId?: string;
}

export interface InspectionProject {
  id: string;
  name: string;
  description: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
  files: InspectionFile[];
}
