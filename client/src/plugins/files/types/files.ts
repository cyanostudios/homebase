// plugins/files/types/files.ts
export type ValidationError = { field: string; message: string };

export interface FileItem {
  id: string;
  name: string;
  size?: number | null;           // bytes
  mimeType?: string | null;
  uploadedBy?: string | null;     // user id/email/name if available
  url?: string | null;            // presigned or relative path
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}
