// client/src/plugins/files/context/FilesContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import { useApp } from '@/core/api/AppContext';

import {
  cloudStorageApi,
  type CloudStorageSettings,
  type CloudStorageService,
} from '../api/cloudStorageApi';
import { filesApi, type FilesApi } from '../api/filesApi';
import type { ValidationError, FileItem } from '../types/files';

interface FilesContextType {
  isFilesPanelOpen: boolean;
  currentFile: FileItem | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  files: FileItem[];
  refetchFiles: (folderPath?: string | null) => Promise<void>;

  // Folder navigation
  currentFolderPath: string | null;
  setCurrentFolderPath: (path: string | null) => void;
  folders: string[];
  loadFolders: () => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  moveFile: (id: string, folderPath: string | null) => Promise<void>;

  openFilesPanel: (item: FileItem | null) => void;
  openFilePanel: (item: FileItem | null) => void; // Alias for App.tsx primaryAction
  openFileForEdit: (item: FileItem) => void;
  openFileForView: (item: FileItem) => void;
  closeFilePanel: () => void;
  closeFilesPanel: () => void;
  saveFile: (data: any) => Promise<boolean>;
  deleteFile: (id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // Selection & bulk actions
  selectedFileIds: string[];
  selectedFolderPaths: string[];
  toggleFileSelected: (id: string) => void;
  toggleFolderSelected: (path: string) => void;
  selectAllFiles: (ids: string[]) => void;
  selectAllVisible: (fileIds: string[], folderPaths: string[]) => void;
  clearFileSelection: () => void;
  deleteFiles: (ids: string[], folderPaths?: string[]) => Promise<void>;

  // Cloud storage
  cloudStorageSettings: { googledrive: CloudStorageSettings | null };
  loadCloudStorageSettings: () => Promise<void>;
  connectCloudStorage: (service: CloudStorageService) => Promise<void>;
  disconnectCloudStorage: (service: CloudStorageService) => Promise<void>;
  getCloudStorageEmbedUrl: (service: CloudStorageService) => Promise<string | null>;

  // PanelTitles integration
  getPanelTitle: (
    mode: 'create' | 'edit' | 'view',
    item: FileItem | null,
    isMobile?: boolean,
  ) => string;
  getPanelSubtitle: (mode: 'create' | 'edit' | 'view', item: FileItem | null) => React.ReactNode;
  getDeleteMessage: (item: FileItem | null) => string;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: (except?: string) => void;
  api?: FilesApi;
}

export function FilesProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
  api = filesApi,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([]);
  const [currentFolderPath, setCurrentFolderPathState] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [cloudStorageSettings, setCloudStorageSettings] = useState<{
    googledrive: CloudStorageSettings | null;
  }>({
    googledrive: null,
  });

  useEffect(() => {
    if (isAuthenticated) {
      void loadItems();
      void loadFolders();
      void loadCloudStorageSettings();
    } else {
      setFiles([]);
      setFolders([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on auth change only
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderPath, isAuthenticated]);

  useEffect(() => {
    registerPanelCloseFunction('files', closeFilePanel);
    return () => unregisterPanelCloseFunction('files');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (window as any).submitFilesForm = () => {
      window.dispatchEvent(new CustomEvent('submitFileForm'));
    };
    (window as any).cancelFilesForm = () => {
      window.dispatchEvent(new CustomEvent('cancelFileForm'));
    };
    return () => {
      delete (window as any).submitFilesForm;
      delete (window as any).cancelFilesForm;
    };
  }, []);

  const normalize = (it: any): FileItem => ({
    ...it,
    createdAt: it?.createdAt ? new Date(it.createdAt) : null,
    updatedAt: it?.updatedAt ? new Date(it.updatedAt) : null,
  });

  async function loadItems(folderPathOverride?: string | null) {
    try {
      const path =
        folderPathOverride !== undefined ? (folderPathOverride ?? '') : (currentFolderPath ?? '');
      const items: any[] = await api.getItems(path);
      setFiles(items.map(normalize));
    } catch (e: any) {
      console.warn('[files] getItems failed:', e);
      // V2: Handle standardized error format
      const errorMessage = e?.message || e?.error || 'Failed to load files';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }

  const validate = (data: any): ValidationError[] => {
    const errs: ValidationError[] = [];
    const hasMany = Array.isArray(data?._files) && data._files.length > 0;
    if (!hasMany && !String(data?.name ?? '').trim()) {
      errs.push({ field: 'name', message: 'Filename is required' });
    }
    return errs;
  };

  const openFilesPanel = (item: FileItem | null) => {
    setCurrentFile(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsFilesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openFileForEdit = (item: FileItem) => {
    setCurrentFile(item);
    setPanelMode('edit');
    setIsFilesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openFileForView = (item: FileItem) => {
    setCurrentFile(item);
    setPanelMode('view');
    setIsFilesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const closeFilesPanel = () => {
    setIsFilesPanelOpen(false);
    setCurrentFile(null);
    setPanelMode('create');
    setValidationErrors([]);
  };
  const closeFilePanel = () => closeFilesPanel();
  const clearValidationErrors = () => setValidationErrors([]);

  const saveFile = async (raw: any): Promise<boolean> => {
    const errors = validate(raw);
    setValidationErrors(errors);
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) {
      return false;
    }

    const batch = Array.isArray(raw?._files) ? (raw._files as File[]) : [];

    // MULTIPART CREATE (en eller flera filer)
    if (!currentFile && batch.length >= 1) {
      try {
        const created = await api.uploadFiles(batch, currentFolderPath ?? undefined); // returns array
        const normalized = (created as any[]).map(normalize);
        setFiles((prev) => [...prev, ...normalized]);
        void loadFolders();
        closeFilesPanel();
        return true;
      } catch (err: any) {
        console.error('Upload failed:', err);

        // V2: Handle standardized error format from backend
        const validationErrors: ValidationError[] = [];

        // Check for field-level errors (409 conflicts)
        if (err?.status === 409 && Array.isArray(err.errors)) {
          validationErrors.push(...err.errors);
        }
        // Check if backend returned validation errors in details array
        else if (err?.details && Array.isArray(err.details)) {
          err.details.forEach((detail: any) => {
            if (typeof detail === 'string') {
              validationErrors.push({ field: 'general', message: detail });
            } else if (detail?.field && detail?.message) {
              validationErrors.push({ field: detail.field, message: detail.message });
            } else if (detail?.msg) {
              validationErrors.push({ field: detail.param || 'general', message: detail.msg });
            }
          });
        }
        // Check for 400 errors with message
        else if (err?.status === 400 && err?.message) {
          validationErrors.push({ field: '_files', message: err.message });
        }

        // If no validation errors from backend, use error message
        if (validationErrors.length === 0) {
          const errorMessage = err?.message || err?.error || 'Failed to upload. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        return false;
      }
    }

    // RENAME (update metadata)
    try {
      if (currentFile) {
        const saved: any = await api.updateItem((currentFile as any).id, raw);
        const normalized = normalize(saved);
        setFiles((prev) => prev.map((i) => (i.id === (currentFile as any).id ? normalized : i)));
        closeFilesPanel(); // stäng panel efter update
      } else {
        const saved: any = await api.createItem(raw);
        setFiles((prev) => [...prev, normalize(saved)]);
        closeFilesPanel();
      }
      setValidationErrors([]);
      return true;
    } catch (err: any) {
      console.error('Failed to save file:', err);

      // V2: Handle standardized error format from backend
      const validationErrors: ValidationError[] = [];

      // Check for field-level errors (409 conflicts)
      if (err?.status === 409 && Array.isArray(err.errors)) {
        validationErrors.push(...err.errors);
      }
      // Check if backend returned validation errors in details array
      else if (err?.details && Array.isArray(err.details)) {
        err.details.forEach((detail: any) => {
          if (typeof detail === 'string') {
            validationErrors.push({ field: 'general', message: detail });
          } else if (detail?.field && detail?.message) {
            validationErrors.push({ field: detail.field, message: detail.message });
          } else if (detail?.msg) {
            validationErrors.push({ field: detail.param || 'general', message: detail.msg });
          }
        });
      }
      // Check for 400 errors with message
      else if (err?.status === 400 && err?.message) {
        validationErrors.push({ field: 'general', message: err.message });
      }

      // If no validation errors from backend, use error message
      if (validationErrors.length === 0) {
        const errorMessage = err?.message || err?.error || 'Failed to save. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }

      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteFile = async (id: string) => {
    try {
      await api.deleteItem(id);
      setFiles((prev) => prev.filter((i) => i.id !== id));
      setSelectedFileIds((prev) => prev.filter((fid) => fid !== id));
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      // V2: Handle standardized error format
      const errorMessage = err?.message || err?.error || 'Failed to delete file';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  // Bulk delete
  const deleteFiles = async (ids: string[], folderPaths?: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    const uniquePaths = Array.from(new Set((folderPaths || []).filter(Boolean)));
    if (!uniqueIds.length && !uniquePaths.length) {
      return;
    }

    try {
      await api.deleteFilesBulk(uniqueIds, uniquePaths);
      setFiles((prev) => prev.filter((f) => !uniqueIds.includes(String(f.id))));
      setSelectedFileIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));
      setSelectedFolderPaths((prev) => prev.filter((p) => !uniquePaths.includes(p)));
      await loadItems();
      await loadFolders();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete files';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  // Selection helpers
  const toggleFileSelected = (id: string) => {
    const key = String(id);
    setSelectedFileIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const toggleFolderSelected = (folderPath: string) => {
    setSelectedFolderPaths((prev) =>
      prev.includes(folderPath) ? prev.filter((x) => x !== folderPath) : [...prev, folderPath],
    );
  };

  const selectAllFiles = (ids: string[]) => {
    const norm = Array.isArray(ids) ? ids.map(String) : [];
    setSelectedFileIds(norm);
  };

  const selectAllVisible = (fileIds: string[], folderPaths: string[]) => {
    setSelectedFileIds(Array.from(new Set(fileIds.map(String))));
    setSelectedFolderPaths(Array.from(new Set(folderPaths)));
  };

  const clearFileSelection = () => {
    setSelectedFileIds([]);
    setSelectedFolderPaths([]);
  };

  // Cloud storage functions
  async function loadCloudStorageSettings() {
    try {
      const googledrive = await cloudStorageApi.getSettings('googledrive').catch(() => null);
      setCloudStorageSettings({ googledrive });
    } catch (err) {
      console.error('Failed to load cloud storage settings:', err);
    }
  }

  const connectCloudStorage = async (service: CloudStorageService) => {
    try {
      const { authUrl } = await cloudStorageApi.startAuth(service);
      window.location.href = authUrl;
    } catch (err: any) {
      console.error(`Failed to start ${service} OAuth:`, err);
      setValidationErrors([{ field: 'general', message: `Failed to connect ${service}` }]);
    }
  };

  const disconnectCloudStorage = async (service: CloudStorageService) => {
    try {
      await cloudStorageApi.disconnect(service);
      await loadCloudStorageSettings();
    } catch (err: any) {
      console.error(`Failed to disconnect ${service}:`, err);
      setValidationErrors([{ field: 'general', message: `Failed to disconnect ${service}` }]);
    }
  };

  const getCloudStorageEmbedUrl = async (service: CloudStorageService): Promise<string | null> => {
    try {
      const { embedUrl } = await cloudStorageApi.getEmbedUrl(service);
      return embedUrl;
    } catch (err) {
      console.error(`Failed to get ${service} embed URL:`, err);
      return null;
    }
  };

  // ---- PanelTitles helpers ----
  const humanSize = (bytes?: number | null) => {
    if ((bytes ?? null) === null || !Number.isFinite(bytes)) {
      return '—';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
    let n = bytes,
      i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const getPanelTitle = (mode: 'create' | 'edit' | 'view', item: FileItem | null): string => {
    if (mode === 'create') {
      return 'Upload Files';
    }
    if (mode === 'edit') {
      return 'Rename File';
    }
    return item?.name || 'File';
  };

  const getPanelSubtitle = (
    mode: 'create' | 'edit' | 'view',
    item: FileItem | null,
  ): React.ReactNode => {
    if (mode === 'create') {
      return 'Select one or multiple files to upload';
    }
    if (mode === 'edit') {
      return 'Change the file name and save';
    }
    if (item) {
      const type = item.mimeType || 'application/octet-stream';
      const size = humanSize(item.size);
      return `${type} • ${size}`;
    }
    return '';
  };

  const getDeleteMessage = (item: FileItem | null): string => {
    const name = item?.name || 'this file';
    return `Are you sure you want to delete "${name}"? This will also remove the physical file.`;
  };

  const refetchFiles = async (folderPath?: string | null) => {
    await loadItems(folderPath);
    await loadFolders();
  };

  const setCurrentFolderPath = (path: string | null) => {
    setCurrentFolderPathState(path);
  };

  async function loadFolders() {
    try {
      const list = await api.getFolders();
      setFolders(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[files] getFolders failed:', e);
      setFolders([]);
    }
  }

  const createFolder = async (folderPath: string) => {
    await api.createFolder(folderPath);
    await loadFolders();
  };

  const moveFile = async (id: string, folderPath: string | null) => {
    await api.moveFile(id, folderPath);
    await loadItems();
    await loadFolders();
  };

  const value: FilesContextType = {
    isFilesPanelOpen,
    currentFile,
    panelMode,
    validationErrors,
    files,
    refetchFiles,
    currentFolderPath,
    setCurrentFolderPath,
    folders,
    loadFolders,
    createFolder,
    moveFile,
    cloudStorageSettings,
    loadCloudStorageSettings,
    connectCloudStorage,
    disconnectCloudStorage,
    getCloudStorageEmbedUrl,
    selectedFileIds,
    selectedFolderPaths,
    toggleFileSelected,
    toggleFolderSelected,
    selectAllFiles,
    selectAllVisible,
    clearFileSelection,
    openFilesPanel,
    openFilePanel: openFilesPanel, // Alias for App.tsx primaryAction (singular)
    openFileForEdit,
    openFileForView,
    closeFilePanel,
    closeFilesPanel,
    saveFile,
    deleteFile,
    deleteFiles,
    clearValidationErrors,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}

export function useFilesContext() {
  const ctx = useContext(FilesContext);
  if (!ctx) {
    throw new Error('useFilesContext must be used within a FilesProvider');
  }
  return ctx;
}
