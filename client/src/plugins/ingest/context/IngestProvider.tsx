import React, { useCallback, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';

import { ingestApi } from '../api/ingestApi';
import type { IngestRun, IngestSource, PanelMode, ValidationError } from '../types/ingest';

import { IngestContext } from './IngestContext';
import type { IngestContextType } from './IngestContext';

function useIngestContextValue(
  isAuthenticated: boolean,
  onCloseOtherPanels: () => void,
  t: (key: string, opts?: Record<string, unknown>) => string,
): IngestContextType {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/ingest');

  const [isIngestPanelOpen, setIsIngestPanelOpen] = useState(false);
  const [currentIngest, setCurrentIngest] = useState<IngestSource | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [ingest, setIngest] = useState<IngestSource[]>([]);
  const [ingestRuns, setIngestRuns] = useState<IngestRun[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [importRunning, setImportRunning] = useState(false);

  const {
    selectedIds: selectedIngestIds,
    toggleSelection: toggleIngestSelectedCore,
    selectAll: selectAllIngestCore,
    mergeIntoSelection: mergeIntoIngestSelectionCore,
    clearSelection: clearIngestSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const loadIngestSources = useCallback(async (): Promise<IngestSource[]> => {
    try {
      const data = await ingestApi.getSources();
      setIngest(data);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load sources';
      setValidationErrors([{ field: 'general', message: msg }]);
      return [];
    }
  }, [setValidationErrors]);

  const loadIngestRuns = useCallback(async (sourceId: string) => {
    setRunsLoading(true);
    try {
      const runs = await ingestApi.getRuns(sourceId, 50);
      setIngestRuns(runs);
    } catch {
      setIngestRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const closeIngestPanel = useCallback(() => {
    setIsIngestPanelOpen(false);
    setCurrentIngest(null);
    setPanelMode('create');
    setValidationErrors([]);
    setIngestRuns([]);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('ingest', closeIngestPanel);
    return () => unregisterPanelCloseFunction('ingest');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeIngestPanel]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadIngestSources();
    } else {
      setIngest([]);
    }
  }, [isAuthenticated, loadIngestSources]);

  const openIngestPanel = useCallback(
    (item: IngestSource | null) => {
      clearIngestSelectionCore();
      setCurrentIngest(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsIngestPanelOpen(true);
      setValidationErrors([]);
      setIngestRuns([]);
      onCloseOtherPanels();
    },
    [clearIngestSelectionCore, onCloseOtherPanels, setValidationErrors],
  );

  const openIngestForEdit = useCallback(
    (item: IngestSource) => {
      clearIngestSelectionCore();
      setCurrentIngest(item);
      setPanelMode('edit');
      setIsIngestPanelOpen(true);
      setValidationErrors([]);
      setIngestRuns([]);
      onCloseOtherPanels();
    },
    [clearIngestSelectionCore, onCloseOtherPanels, setValidationErrors],
  );

  const openIngestForView = useCallback(
    (item: IngestSource) => {
      clearIngestSelectionCore();
      setCurrentIngest(item);
      setPanelMode('view');
      setIsIngestPanelOpen(true);
      setValidationErrors([]);
      void loadIngestRuns(item.id);
      onCloseOtherPanels();
      navigateToItem(item, ingest, 'name');
    },
    [
      clearIngestSelectionCore,
      ingest,
      loadIngestRuns,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );

  const validate = useCallback(
    (data: Record<string, unknown>): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!String(data.name || '').trim()) {
        errors.push({ field: 'name', message: t('ingest.errors.nameRequired') });
      }
      if (!String(data.sourceUrl || '').trim()) {
        errors.push({ field: 'sourceUrl', message: t('ingest.errors.urlRequired') });
      } else {
        try {
          new URL(String(data.sourceUrl));
        } catch {
          errors.push({ field: 'sourceUrl', message: t('ingest.errors.urlInvalid') });
        }
      }
      const fm = data.fetchMethod;
      if (typeof fm === 'string' && fm !== '' && fm !== 'generic_http' && fm !== 'browser_fetch') {
        errors.push({ field: 'fetchMethod', message: t('ingest.errors.fetchMethodInvalid') });
      }
      return errors;
    },
    [t],
  );

  const saveIngest = useCallback(
    async (data: Record<string, unknown>) => {
      const errors = validate(data);
      if (errors.length) {
        setValidationErrors(errors);
        return false;
      }
      setIsSaving(true);
      try {
        const payload = {
          name: String(data.name).trim(),
          sourceUrl: String(data.sourceUrl).trim(),
          sourceType: data.sourceType || 'other',
          fetchMethod: data.fetchMethod === 'browser_fetch' ? 'browser_fetch' : 'generic_http',
          isActive: data.isActive !== false,
          notes: data.notes ? String(data.notes) : null,
        };
        if (panelMode === 'create') {
          const created = await ingestApi.createSource(payload);
          const list = await loadIngestSources();
          setCurrentIngest(created);
          setPanelMode('view');
          setValidationErrors([]);
          navigateToItem(created, list.length ? list : [created], 'name');
          void loadIngestRuns(created.id);
          return true;
        }
        if (currentIngest?.id) {
          const updated = await ingestApi.updateSource(currentIngest.id, payload);
          const list = await loadIngestSources();
          setCurrentIngest(updated);
          setPanelMode('view');
          setValidationErrors([]);
          navigateToItem(updated, list.length ? list : [updated], 'name');
          void loadIngestRuns(updated.id);
          return true;
        }
        return false;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('ingest.errors.saveFailed');
        setValidationErrors([{ field: 'general', message: msg }]);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      currentIngest?.id,
      loadIngestRuns,
      loadIngestSources,
      navigateToItem,
      panelMode,
      setValidationErrors,
      t,
      validate,
    ],
  );

  const deleteIngest = useCallback(
    async (id: string) => {
      await ingestApi.deleteSource(id);
      await loadIngestSources();
      if (currentIngest?.id === id) {
        closeIngestPanel();
      }
    },
    [closeIngestPanel, currentIngest?.id, loadIngestSources],
  );

  const deleteIngestSources = useCallback(
    async (ids: string[]) => {
      const normalized = Array.isArray(ids) ? ids.map(String) : [];
      for (const id of normalized) {
        await ingestApi.deleteSource(id);
      }
      await loadIngestSources();
      clearIngestSelectionCore();
      if (currentIngest?.id && normalized.includes(String(currentIngest.id))) {
        closeIngestPanel();
      }
    },
    [clearIngestSelectionCore, closeIngestPanel, currentIngest?.id, loadIngestSources],
  );

  const runIngestImport = useCallback(
    async (sourceId: string) => {
      setImportRunning(true);
      try {
        const { source } = await ingestApi.runImport(sourceId);
        await loadIngestSources();
        if (currentIngest?.id === sourceId) {
          setCurrentIngest(source);
        }
        await loadIngestRuns(sourceId);
      } finally {
        setImportRunning(false);
      }
    },
    [currentIngest?.id, loadIngestRuns, loadIngestSources],
  );

  const getDeleteMessage = useCallback(
    (item: IngestSource | null) => buildDeleteMessage(t as any, 'ingest', item?.name || undefined),
    [t],
  );

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(ingest, currentIngest, openIngestForView);

  return {
    isIngestPanelOpen,
    currentIngest,
    currentIngestSource: currentIngest,
    panelMode,
    validationErrors,
    ingest,
    ingestSources: ingest,
    ingestRuns,
    runsLoading,
    importRunning,
    isSaving,
    openIngestPanel,
    openIngestForEdit,
    openIngestForView,
    openIngestSourceForEdit: openIngestForEdit,
    openIngestSourceForView: openIngestForView,
    closeIngestPanel,
    saveIngest,
    saveIngestSource: saveIngest,
    deleteIngest,
    deleteIngestSource: deleteIngest,
    deleteIngestSources,
    loadIngestRuns,
    loadIngestSources,
    runIngestImport,
    runIngestSource: runIngestImport,
    clearValidationErrors,
    selectedIngestIds,
    toggleIngestSelected: toggleIngestSelectedCore,
    selectAllIngest: selectAllIngestCore,
    mergeIntoIngestSelection: mergeIntoIngestSelectionCore,
    clearIngestSelection: clearIngestSelectionCore,
    selectedCount,
    isSelected,
    getDeleteMessage,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  };
}

interface IngestProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function IngestProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: IngestProviderProps) {
  const { t } = useTranslation();
  const value = useIngestContextValue(isAuthenticated, onCloseOtherPanels, t);
  return <IngestContext.Provider value={value}>{children}</IngestContext.Provider>;
}
