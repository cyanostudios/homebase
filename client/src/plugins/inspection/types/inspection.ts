export interface InspectionFile {
  id: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
  url?: string | null;
  linkId?: string;
}

export interface InspectionFileList {
  id: string;
  sourceListId: string;
  sourceListName: string;
  createdAt: string;
  fileIds: string[];
}

export interface InspectionProject {
  id: string;
  name: string;
  description: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
  files: InspectionFile[];
  fileLists?: InspectionFileList[];
  /** Antal filer – servern returnerar alltid detta (getAll räknar från DB, getById från files.length). */
  fileCount?: number;
}
