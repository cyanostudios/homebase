import React, { createContext, useContext } from 'react';

import type { CloudStorageService, CloudStorageSettings } from '../api/cloudStorageApi';
import type { ValidationError, FileItem } from '../types/files';

export interface FilesContextType {
  isFilesPanelOpen: boolean;
  currentFile: FileItem | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  files: FileItem[];

  openFilesPanel: (item: FileItem | null) => void;
  openFilePanel: (item: FileItem | null) => void;
  openFileForEdit: (item: FileItem) => void;
  openFileForView: (item: FileItem) => void;
  openFileSettings: () => void;
  closeFileSettingsView: () => void;
  closeFilePanel: () => void;
  filesContentView: 'list' | 'settings';
  closeFilesPanel: () => void;
  saveFile: (data: any) => Promise<boolean>;
  deleteFile: (id: string) => Promise<void>;
  clearValidationErrors: () => void;

  getPanelSubtitle: (
    mode: 'create' | 'edit' | 'view' | 'settings',
    item: FileItem | null,
  ) => React.ReactNode;
  getDeleteMessage: (item: FileItem | null) => string;

  cloudStorageSettings: {
    onedrive: CloudStorageSettings | null;
    dropbox: CloudStorageSettings | null;
    googledrive: CloudStorageSettings | null;
  };
  loadCloudStorageSettings: () => Promise<void>;
  connectCloudStorage: (service: CloudStorageService) => Promise<void>;
  disconnectCloudStorage: (service: CloudStorageService) => Promise<void>;
  getCloudStorageEmbedUrl: (service: CloudStorageService) => Promise<string | null>;
  selectedFileIds: string[];
  toggleFileSelected: (id: string) => void;
  selectAllFiles: (ids: string[]) => void;
  mergeIntoFileSelection: (ids: string[]) => void;
  clearFileSelection: () => void;
  deleteFiles: (ids: string[]) => Promise<void>;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

export function useFilesContext() {
  const ctx = useContext(FilesContext);
  if (!ctx) {
    throw new Error('useFilesContext must be used within a FilesProvider');
  }
  return ctx;
}

const EMPTY_FILES_CONTEXT: FilesContextType = {
  isFilesPanelOpen: false,
  currentFile: null,
  panelMode: 'create',
  validationErrors: [],
  files: [],
  cloudStorageSettings: { onedrive: null, dropbox: null, googledrive: null },
  loadCloudStorageSettings: async () => {},
  connectCloudStorage: async () => {},
  disconnectCloudStorage: async () => {},
  getCloudStorageEmbedUrl: async () => null,
  selectedFileIds: [],
  toggleFileSelected: () => {},
  selectAllFiles: () => {},
  mergeIntoFileSelection: () => {},
  clearFileSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  openFilesPanel: () => {},
  openFilePanel: () => {},
  openFileForEdit: () => {},
  openFileForView: () => {},
  openFileSettings: () => {},
  closeFileSettingsView: () => {},
  closeFilePanel: () => {},
  filesContentView: 'list',
  closeFilesPanel: () => {},
  saveFile: async () => false,
  deleteFile: async () => {},
  deleteFiles: async () => {},
  clearValidationErrors: () => {},
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function FilesNullProvider({ children }: { children: React.ReactNode }) {
  return <FilesContext.Provider value={EMPTY_FILES_CONTEXT}>{children}</FilesContext.Provider>;
}

export { FilesContext };
