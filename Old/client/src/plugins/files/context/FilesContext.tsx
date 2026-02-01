// client/src/plugins/files/context/FilesContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useApp } from '@/core/api/AppContext';
import { filesApi, type FilesApi } from '../api/filesApi';
import type { ValidationError, FileItem } from '../types/files';

interface FilesContextType {
  isFilesPanelOpen: boolean;
  currentFile: FileItem | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  files: FileItem[];

  openFilesPanel: (item: FileItem | null) => void;
  openFileForEdit: (item: FileItem) => void;
  openFileForView: (item: FileItem) => void;
  closeFilePanel: () => void;
  closeFilesPanel: () => void;
  saveFile: (data: any) => Promise<boolean>;
  deleteFile: (id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // PanelTitles integration
  getPanelTitle: (mode: 'create' | 'edit' | 'view', item: FileItem | null, isMobile?: boolean) => string;
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

  useEffect(() => {
    if (isAuthenticated) void loadItems();
    else setFiles([]);
  }, [isAuthenticated]);

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

  const loadItems = async () => {
    try {
      const items: any[] = await api.getItems();
      setFiles(items.map(normalize));
    } catch (e) {
      console.warn('[files] getItems failed:', e);
    }
  };

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
    if (blocking.length > 0) return false;

    const batch = Array.isArray(raw?._files) ? (raw._files as File[]) : [];

    // MULTIPART CREATE (en eller flera filer)
    if (!currentFile && batch.length >= 1) {
      try {
        const created = await api.uploadFiles(batch); // returns array
        const normalized = (created as any[]).map(normalize);
        setFiles((prev) => [...prev, ...normalized]);
        closeFilesPanel();
        return true;
      } catch (err: any) {
        console.error('Upload failed:', err);
        if (err?.status === 409 && Array.isArray(err.errors)) {
          setValidationErrors(err.errors);
        } else if (err?.status === 400 && err?.message) {
          setValidationErrors([{ field: '_files', message: err.message }]);
        } else {
          setValidationErrors([{ field: 'general', message: 'Failed to upload. Please try again.' }]);
        }
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
      if (err?.status === 409 && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else if (err?.status === 400 && err?.message) {
        setValidationErrors([{ field: 'general', message: err.message }]);
      } else {
        setValidationErrors([{ field: 'general', message: 'Failed to save. Please try again.' }]);
      }
      return false;
    }
  };

  const deleteFile = async (id: string) => {
    try {
      await api.deleteItem(id);
      setFiles((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      console.error('Failed to delete file:', err);
    }
  };

  // ---- PanelTitles helpers ----
  const humanSize = (bytes?: number | null) => {
    if (bytes == null || !Number.isFinite(bytes)) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const getPanelTitle = (mode: 'create' | 'edit' | 'view', item: FileItem | null): string => {
    if (mode === 'create') return 'Upload Files';
    if (mode === 'edit') return 'Rename File';
    return item?.name || 'File';
  };

  const getPanelSubtitle = (mode: 'create' | 'edit' | 'view', item: FileItem | null): React.ReactNode => {
    if (mode === 'create') return 'Select one or multiple files to upload';
    if (mode === 'edit') return 'Change the file name and save';
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

  const value: FilesContextType = {
    isFilesPanelOpen,
    currentFile,
    panelMode,
    validationErrors,
    files,
    openFilesPanel,
    openFileForEdit,
    openFileForView,
    closeFilePanel,
    closeFilesPanel,
    saveFile,
    deleteFile,
    clearValidationErrors,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}

export function useFilesContext() {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error('useFilesContext must be used within a FilesProvider');
  return ctx;
}
