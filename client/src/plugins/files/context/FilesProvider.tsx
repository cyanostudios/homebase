import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';
import { formatDate } from '@/core/utils/dateFormat';

import {
  cloudStorageApi,
  type CloudStorageService,
  type CloudStorageSettings,
} from '../api/cloudStorageApi';
import { filesApi, type FilesApi } from '../api/filesApi';
import { FileDetailHeaderMenus } from '../components/FileDetailHeaderMenus';
import type { ValidationError, FileItem } from '../types/files';
import { humanSize } from '../utils/humanSize';

import { FilesContext } from './FilesContext';
import type { FilesContextType } from './FilesContext';

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
  const location = useLocation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/files');

  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesContentView, setFilesContentView] = useState<'list' | 'settings'>('list');

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
    googledrive: CloudStorageSettings | null;
  }>({
    googledrive: null,
  });

  const filesDeepLinkPathSyncedRef = useRef<string | null>(null);

  const closeFilePanel = useCallback(() => {
    setIsFilesPanelOpen(false);
    setCurrentFile(null);
    setPanelMode('create');
    setValidationErrors([]);
    // Prime ref so a lagging pathname effect cannot reopen edit after close.
    filesDeepLinkPathSyncedRef.current = '/files';
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('files', closeFilePanel);
    return () => unregisterPanelCloseFunction('files');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeFilePanel]);

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
      const errorMessage = e?.message || e?.error || 'Failed to load files';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }, [api, setValidationErrors]);

  const loadCloudStorageSettings = useCallback(async () => {
    try {
      const googledrive = await cloudStorageApi.getSettings('googledrive').catch(() => null);
      setCloudStorageSettings({ googledrive });
    } catch (err) {
      console.error('Failed to load cloud storage settings:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadItems();
      void loadCloudStorageSettings();
    } else {
      setFiles([]);
    }
  }, [isAuthenticated, loadItems, loadCloudStorageSettings]);

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
          ? t('files.oauthSessionExpired')
          : message === 'invalid_state'
            ? t('files.oauthInvalidState')
            : message === 'oauth_not_configured'
              ? t('files.oauthNotConfigured')
              : t('files.oauthConnectFailed', { message: message ? `: ${message}` : '' });
      setValidationErrors([{ field: 'general', message: label }]);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setValidationErrors, loadCloudStorageSettings, t]);

  const validate = (data: any): ValidationError[] => {
    const errs: ValidationError[] = [];
    const hasMany = Array.isArray(data?._files) && data._files.length > 0;
    if (!hasMany && !String(data?.name ?? '').trim()) {
      errs.push({ field: 'name', message: t('files.validationNameRequired') });
    }
    return errs;
  };

  const openFilePanel = useCallback(
    (item: FileItem | null) => {
      clearFileSelectionCore();
      setCurrentFile(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsFilesPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (item) {
        const slug = buildSlug(item, files, 'name');
        filesDeepLinkPathSyncedRef.current = `/files/${slug}`;
        navigateToItem(item, files, 'name');
      }
    },
    [onCloseOtherPanels, clearFileSelectionCore, navigateToItem, files, setValidationErrors],
  );

  const openFileForEdit = useCallback(
    (item: FileItem) => {
      clearFileSelectionCore();
      setCurrentFile(item);
      setPanelMode('edit');
      setIsFilesPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      const slug = buildSlug(item, files, 'name');
      filesDeepLinkPathSyncedRef.current = `/files/${slug}`;
      navigateToItem(item, files, 'name');
    },
    [onCloseOtherPanels, clearFileSelectionCore, navigateToItem, files, setValidationErrors],
  );

  const openFileForView = useCallback(
    (item: FileItem) => {
      clearFileSelectionCore();
      setCurrentFile(item);
      setPanelMode('view');
      setIsFilesPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      const slug = buildSlug(item, files, 'name');
      filesDeepLinkPathSyncedRef.current = `/files/${slug}`;
      navigateToItem(item, files, 'name');
    },
    [onCloseOtherPanels, clearFileSelectionCore, navigateToItem, files, setValidationErrors],
  );

  const openFileForViewRef = useRef(openFileForView);
  useEffect(() => {
    openFileForViewRef.current = openFileForView;
  }, [openFileForView]);

  useEffect(() => {
    if (files.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'files') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      filesDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (filesDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, files, 'name');
    filesDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openFileForViewRef.current(item as FileItem);
    }
  }, [location.pathname, files]);

  const openFileSettings = useCallback(() => {
    setFilesContentView('settings');
  }, []);

  const closeFileSettingsView = useCallback(() => {
    setFilesContentView('list');
  }, []);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(files, currentFile, openFileForView);

  const saveFile = async (raw: any): Promise<boolean> => {
    const errors = validate(raw);
    setValidationErrors(errors);
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) {
      return false;
    }

    const batch = Array.isArray(raw?._files) ? (raw._files as File[]) : [];

    if (!currentFile && batch.length >= 1) {
      try {
        const created = await api.uploadFiles(batch);
        const normalized = (created as any[]).map(normalize);
        setFiles((prev) => [...prev, ...normalized]);
        closeFilePanel();
        return true;
      } catch (err: any) {
        console.error('Upload failed:', err);
        const validationErrors: ValidationError[] = [];
        if (err?.status === 409 && Array.isArray(err.errors)) {
          validationErrors.push(...err.errors);
        } else if (err?.status === 400 && err?.message) {
          validationErrors.push({ field: '_files', message: err.message });
        }
        if (validationErrors.length === 0) {
          validationErrors.push({
            field: 'general',
            message: err?.message || t('files.uploadFailed'),
          });
        }
        setValidationErrors(validationErrors);
        return false;
      }
    }

    try {
      if (currentFile) {
        const saved: any = await api.updateItem(currentFile.id, raw);
        const normalized = normalize(saved);
        setFiles((prev) => prev.map((i) => (i.id === currentFile.id ? normalized : i)));
        setValidationErrors([]);
        openFileForView(normalized);
        return true;
      }
      const saved: any = await api.createItem(raw);
      setFiles((prev) => [...prev, normalize(saved)]);
      closeFilePanel();
      setValidationErrors([]);
      return true;
    } catch (err: any) {
      console.error('Failed to save file:', err);
      const validationErrors: ValidationError[] = [];
      if (err?.status === 409 && Array.isArray(err.errors)) {
        validationErrors.push(...err.errors);
      } else if (err?.status === 400 && err?.message) {
        validationErrors.push({ field: 'general', message: err.message });
      }
      if (validationErrors.length === 0) {
        validationErrors.push({
          field: 'general',
          message: err?.message || t('files.saveFailed'),
        });
      }
      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteFile = async (id: string) => {
    try {
      await api.deleteItem(id);
      setFiles((prev) => prev.filter((i) => i.id !== id));
      if (isSelected(id)) {
        toggleFileSelectedCore(id);
      }
      if (currentFile && String(currentFile.id) === String(id)) {
        closeFilePanel();
      }
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      setValidationErrors([{ field: 'general', message: err?.message || t('files.deleteFailed') }]);
    }
  };

  const deleteFiles = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) {
      return;
    }
    try {
      await bulkApi.bulkDelete('files', uniqueIds);
      setFiles((prev) => prev.filter((f) => !uniqueIds.includes(String(f.id))));
      clearFileSelectionCore();
      if (currentFile && uniqueIds.includes(String(currentFile.id))) {
        closeFilePanel();
      }
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      setValidationErrors([
        { field: 'general', message: error?.message || t('files.deleteFailed') },
      ]);
    }
  };

  const connectCloudStorage = async (service: CloudStorageService) => {
    try {
      const { authUrl } = await cloudStorageApi.startAuth(service);
      window.location.href = authUrl;
    } catch (err: any) {
      console.error(`Failed to start ${service} OAuth:`, err);
      setValidationErrors([{ field: 'general', message: t('files.cloudConnectFailed') }]);
    }
  };

  const disconnectCloudStorage = async (service: CloudStorageService) => {
    try {
      await cloudStorageApi.disconnect(service);
      await loadCloudStorageSettings();
    } catch (err: any) {
      console.error(`Failed to disconnect ${service}:`, err);
      setValidationErrors([{ field: 'general', message: t('files.cloudDisconnectFailed') }]);
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

  const getPanelTitle = (mode: string, item: FileItem | null) => {
    if (mode === 'view' && item) {
      return <FileDetailHeaderMenus key={String(item.id)} file={item} />;
    }
    return null;
  };

  const getPanelSubtitle = (
    mode: 'create' | 'edit' | 'view',
    item: FileItem | null,
  ): React.ReactNode => {
    if (mode === 'create') {
      return t('files.panelSubtitleCreate');
    }
    if (mode === 'edit') {
      return t('files.panelSubtitleEdit');
    }
    if (item) {
      const type = item.mimeType || 'application/octet-stream';
      const size = humanSize(item.size);
      const created = item.createdAt ? formatDate(item.createdAt) : '';
      return (
        <div className="flex items-center gap-2 text-xs">
          <span>{type}</span>
          <span className="text-muted-foreground/30 font-light">•</span>
          <span>{size}</span>
          {created ? (
            <>
              <span className="text-muted-foreground/30 font-light">•</span>
              <span className="text-muted-foreground">
                {t('files.panelUploaded', { date: created })}
              </span>
            </>
          ) : null}
        </div>
      );
    }
    return '';
  };

  const getDeleteMessage = (item: FileItem | null): string => {
    const name = item?.name || t('files.thisFile');
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
    toggleFileSelected: toggleFileSelectedCore,
    selectAllFiles: selectAllFilesCore,
    mergeIntoFileSelection: mergeIntoFileSelectionCore,
    clearFileSelection: clearFileSelectionCore,
    selectedCount,
    isSelected,
    openFilePanel,
    openFileForEdit,
    openFileForView,
    openFileSettings,
    closeFileSettingsView,
    closeFilePanel,
    filesContentView,
    saveFile,
    deleteFile,
    deleteFiles,
    clearValidationErrors,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  };

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}
