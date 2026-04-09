// client/src/plugins/files/context/FilesContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { resolveSlug } from '@/core/utils/slugUtils';

import {
  cloudStorageApi,
  type CloudStorageService,
  type CloudStorageSettings,
} from '../api/cloudStorageApi';
import { filesApi, type FilesApi } from '../api/filesApi';
import type { ValidationError, FileItem } from '../types/files';

interface FilesContextType {
  isFilesPanelOpen: boolean;
  currentFile: FileItem | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  files: FileItem[];

  openFilesPanel: (item: FileItem | null) => void;
  openFilePanel: (item: FileItem | null) => void; // Alias for App.tsx primaryAction
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

  // Cloud Storage
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
  // Bulk selection from core hook (for compatibility)
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
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/files');

  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesContentView, setFilesContentView] = useState<'list' | 'settings'>('list');

  // Use core bulk selection hook
  const {
    selectedIds: selectedFileIds,
    toggleSelection: toggleFileSelectedCore,
    selectAll: selectAllFilesCore,
    mergeIntoSelection: mergeIntoFileSelectionCore,
    clearSelection: clearFileSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const [cloudStorageSettings, setCloudStorageSettings] = useState<{
    onedrive: CloudStorageSettings | null;
    dropbox: CloudStorageSettings | null;
    googledrive: CloudStorageSettings | null;
  }>({
    onedrive: null,
    dropbox: null,
    googledrive: null,
  });

  useEffect(() => {
    registerPanelCloseFunction('files', closeFilePanel);
    return () => unregisterPanelCloseFunction('files');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalize = (it: any): FileItem => ({
    ...it,
    createdAt: it?.createdAt ? new Date(it.createdAt) : null,
    updatedAt: it?.updatedAt ? new Date(it.updatedAt) : null,
  });

  const loadItems = useCallback(async () => {
    try {
      const items: any[] = await api.getItems();
      setFiles(items.map(normalize));
    } catch (e: any) {
      console.warn('[files] getItems failed:', e);
      // V2: Handle standardized error format
      const errorMessage = e?.message || e?.error || 'Failed to load files';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }, [api]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadItems();
      void loadCloudStorageSettings();
    } else {
      setFiles([]);
    }
  }, [isAuthenticated, loadItems]);

  // Handle OAuth callback: /files?cloud=googledrive&connected=true (or cloud=error&message=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cloud = params.get('cloud');
    const connected = params.get('connected');
    const message = params.get('message');

    if (cloud && cloud !== 'error' && connected === 'true') {
      void loadCloudStorageSettings();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (cloud === 'error') {
      const label =
        message === 'session_expired'
          ? 'Session expired — please log in and try again'
          : message === 'invalid_state'
            ? 'OAuth state mismatch — please try connecting again'
            : message === 'oauth_not_configured'
              ? 'OAuth credentials not configured'
              : `Cloud connect failed${message ? `: ${message}` : ''}`;
      setValidationErrors([{ field: 'general', message: label }]);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || files.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'files' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], files, 'name');
    if (item) {
      didOpenFromUrlRef.current = true;
      openFileForViewRef.current(item as FileItem);
    }
  }, [files]);

  const validate = (data: any): ValidationError[] => {
    const errs: ValidationError[] = [];
    const hasMany = Array.isArray(data?._files) && data._files.length > 0;
    if (!hasMany && !String(data?.name ?? '').trim()) {
      errs.push({ field: 'name', message: 'Filename is required' });
    }
    return errs;
  };

  const openFilesPanel = (item: FileItem | null) => {
    clearFileSelectionCore();
    setCurrentFile(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsFilesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    if (item) {
      navigateToItem(item, files, 'name');
    }
  };
  const openFileForEdit = (item: FileItem) => {
    clearFileSelectionCore();
    setCurrentFile(item);
    setPanelMode('edit');
    setIsFilesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(item, files, 'name');
  };
  const openFileForView = useCallback(
    (item: FileItem) => {
      setCurrentFile(item);
      setPanelMode('view');
      setIsFilesPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(item, files, 'name');
    },
    [onCloseOtherPanels, navigateToItem, files],
  );

  const openFileForViewRef = useRef(openFileForView);
  useEffect(() => {
    openFileForViewRef.current = openFileForView;
  }, [openFileForView]);
  const openFileSettings = () => {
    setFilesContentView('settings');
  };
  const closeFileSettingsView = () => {
    setFilesContentView('list');
  };
  const closeFilesPanel = () => {
    setIsFilesPanelOpen(false);
    setCurrentFile(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  };
  const closeFilePanel = () => closeFilesPanel();

  const currentItemIndex = currentFile ? files.findIndex((f) => f.id === currentFile.id) : -1;
  const totalItems = files.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = files[currentItemIndex - 1];
    if (prev) {
      openFileForView(prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openFileForView identity stable
  }, [hasPrevItem, currentItemIndex, files]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= files.length - 1) {
      return;
    }
    const next = files[currentItemIndex + 1];
    if (next) {
      openFileForView(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openFileForView identity stable
  }, [hasNextItem, currentItemIndex, files]);

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
        const created = await api.uploadFiles(batch); // returns array
        const normalized = (created as any[]).map(normalize);
        setFiles((prev) => [...prev, ...normalized]);
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
      // Remove from selection if selected
      if (isSelected(id)) {
        toggleFileSelectedCore(id);
      }
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      // V2: Handle standardized error format
      const errorMessage = err?.message || err?.error || 'Failed to delete file';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  // Bulk delete using core bulkApi
  const deleteFiles = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) {
      return;
    }

    try {
      await bulkApi.bulkDelete('files', uniqueIds);
      setFiles((prev) => prev.filter((f) => !uniqueIds.includes(String(f.id))));
      clearFileSelectionCore();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete files';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  // Selection helpers - wrap core hook functions for backward compatibility
  const toggleFileSelected = useCallback(
    (id: string) => {
      toggleFileSelectedCore(id);
    },
    [toggleFileSelectedCore],
  );

  const selectAllFiles = useCallback(
    (ids: string[]) => {
      selectAllFilesCore(ids);
    },
    [selectAllFilesCore],
  );

  const mergeIntoFileSelection = useCallback(
    (ids: string[]) => {
      mergeIntoFileSelectionCore(ids);
    },
    [mergeIntoFileSelectionCore],
  );

  const clearFileSelection = useCallback(() => {
    clearFileSelectionCore();
  }, [clearFileSelectionCore]);

  // Cloud storage functions
  const loadCloudStorageSettings = async () => {
    try {
      const [onedrive, dropbox, googledrive] = await Promise.all([
        cloudStorageApi.getSettings('onedrive').catch(() => null),
        cloudStorageApi.getSettings('dropbox').catch(() => null),
        cloudStorageApi.getSettings('googledrive').catch(() => null),
      ]);
      setCloudStorageSettings({ onedrive, dropbox, googledrive });
    } catch (err) {
      console.error('Failed to load cloud storage settings:', err);
    }
  };

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
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
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

  const getPanelSubtitle = (
    mode: 'create' | 'edit' | 'view' | 'settings',
    item: FileItem | null,
  ): React.ReactNode => {
    if (mode === 'settings') {
      return 'Connect and manage cloud storage';
    }
    if (mode === 'create') {
      return 'Select one or multiple files to upload';
    }
    if (mode === 'edit') {
      return 'Change the file name and save';
    }
    if (item) {
      const type = item.mimeType || 'application/octet-stream';
      const size = humanSize(item.size);
      const created = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

      return (
        <div className="flex items-center gap-2 text-xs">
          <span>{type}</span>
          <span className="text-muted-foreground/30 font-light">•</span>
          <span>{size}</span>
          {created && (
            <>
              <span className="text-muted-foreground/30 font-light">•</span>
              <span className="text-muted-foreground">Uploaded {created}</span>
            </>
          )}
        </div>
      );
    }
    return '';
  };

  const getDeleteMessage = (item: FileItem | null): string => {
    const name = item?.name || 'this file';
    return t('files.deleteConfirmNamedPhysical', { name });
  };

  const value: FilesContextType = {
    isFilesPanelOpen,
    currentFile,
    panelMode,
    validationErrors,
    files,
    cloudStorageSettings,
    loadCloudStorageSettings,
    connectCloudStorage,
    disconnectCloudStorage,
    getCloudStorageEmbedUrl,
    selectedFileIds,
    toggleFileSelected,
    selectAllFiles,
    mergeIntoFileSelection,
    clearFileSelection,
    selectedCount,
    isSelected,
    openFilesPanel,
    openFilePanel: openFilesPanel, // Alias for App.tsx primaryAction (singular)
    openFileForEdit,
    openFileForView,
    openFileSettings,
    closeFileSettingsView,
    closeFilePanel,
    filesContentView,
    closeFilesPanel,
    saveFile,
    deleteFile,
    deleteFiles,
    clearValidationErrors,
    getPanelSubtitle,
    getDeleteMessage,

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
    totalItems,
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
