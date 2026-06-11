import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { resolveSlug } from '@/core/utils/slugUtils';

import { requestsApi } from '../api/requestsApi';
import type { RequestPayload } from '../api/requestsApi';
import { DEFAULT_REQUEST_TYPES } from '../types/requests';
import type { Request, RequestValidationError } from '../types/requests';

const REQUESTS_SETTINGS_KEY = 'requests';

import { RequestsContext } from './RequestContext';
import type { RequestsContextType } from './RequestContext';

export function RequestProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const location = useLocation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, getSettings, updateSettings } =
    useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/requests');

  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<RequestValidationError>();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [requestsContentView, setRequestsContentView] = useState<'list' | 'settings'>('list');
  const [requestTypes, setRequestTypes] = useState<string[]>(DEFAULT_REQUEST_TYPES);

  useEffect(() => {
    if (!isAuthenticated) return;
    getSettings(REQUESTS_SETTINGS_KEY).then((s: any) => {
      if (Array.isArray(s?.requestTypes) && s.requestTypes.length > 0) {
        setRequestTypes(s.requestTypes);
      }
    });
  }, [isAuthenticated, getSettings]);

  const saveRequestTypes = useCallback(
    async (types: string[]) => {
      setRequestTypes(types);
      await updateSettings(REQUESTS_SETTINGS_KEY, { requestTypes: types });
    },
    [updateSettings],
  );

  const openRequestSettings = useCallback(() => {
    setRequestsContentView('settings');
  }, []);

  const closeRequestSettingsView = useCallback(() => {
    setRequestsContentView('list');
  }, []);

  const {
    selectedIds: selectedRequestIds,
    toggleSelection: toggleRequestSelected,
    selectAll: selectAllRequests,
    mergeIntoSelection: mergeIntoRequestSelection,
    clearSelection: clearRequestSelection,
    selectedCount,
    isSelected,
  } = useBulkSelection();

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await requestsApi.getRequests());
    } catch (error: any) {
      setValidationErrors([
        { field: 'general', message: error?.message || 'Failed to load requests' },
      ]);
    }
  }, [setValidationErrors]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRequests();
    } else {
      setRequests([]);
    }
  }, [isAuthenticated, loadRequests]);

  const closeRequestPanel = useCallback(() => {
    setIsRequestPanelOpen(false);
    setCurrentRequest(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('requests', closeRequestPanel);
    return () => unregisterPanelCloseFunction('requests');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeRequestPanel]);

  const openRequestPanel = useCallback(
    (request: Request | null) => {
      clearRequestSelection();
      setCurrentRequest(request);
      setPanelMode(request ? 'edit' : 'create');
      setIsRequestPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (request) {
        navigateToItem(request, requests, 'title');
      }
    },
    [clearRequestSelection, navigateToItem, requests, onCloseOtherPanels, setValidationErrors],
  );

  const openRequestForEdit = useCallback(
    (request: Request) => {
      setCurrentRequest(request);
      setPanelMode('edit');
      setIsRequestPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(request, requests, 'title');
    },
    [navigateToItem, requests, onCloseOtherPanels, setValidationErrors],
  );

  const openRequestForViewRef = useRef<(request: Request) => void>(() => {});
  const openRequestForView = useCallback(
    (request: Request) => {
      setCurrentRequest(request);
      setPanelMode('view');
      setIsRequestPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(request, requests, 'title');
    },
    [navigateToItem, requests, onCloseOtherPanels, setValidationErrors],
  );
  useEffect(() => {
    openRequestForViewRef.current = openRequestForView;
  }, [openRequestForView]);

  useEffect(() => {
    if (!requests.length) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'requests') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      return;
    }
    const item = resolveSlug(slug, requests, 'title');
    if (item) {
      openRequestForViewRef.current(item as Request);
    }
  }, [location.pathname, requests]);

  const createRequest = useCallback(
    async (data: RequestPayload): Promise<Request> => {
      const created = await requestsApi.createRequest({
        request_type: requestTypes[0] ?? DEFAULT_REQUEST_TYPES[0],
        status: 'not started',
        priority: 'Medium',
        source: 'internal',
        ...data,
      });
      setRequests((prev) => [created, ...prev]);
      return created;
    },
    [requestTypes],
  );

  const saveRequest = useCallback(
    async (data: RequestPayload, requestId?: string): Promise<boolean> => {
      if (!String(data?.title || '').trim()) {
        setValidationErrors([{ field: 'title', message: 'Request title is required' }]);
        return false;
      }
      setIsSaving(true);
      try {
        if (requestId || currentRequest?.id) {
          const id = String(requestId || currentRequest?.id);
          const updated = await requestsApi.updateRequest(id, data);
          setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
          setCurrentRequest(updated);
          setPanelMode('view');
        } else {
          const created = await requestsApi.createRequest(data);
          setRequests((prev) => [created, ...prev]);
          setCurrentRequest(created);
          // Stay in edit so attachments can be added immediately after first save
          setPanelMode('edit');
          setIsRequestPanelOpen(true);
        }
        setValidationErrors([]);
        return true;
      } catch (error: any) {
        setValidationErrors([
          { field: 'general', message: error?.message || 'Failed to save request' },
        ]);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentRequest, setValidationErrors],
  );

  const deleteRequest = useCallback(
    async (id: string) => {
      await requestsApi.deleteRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (currentRequest?.id === id) {
        closeRequestPanel();
      }
    },
    [currentRequest, closeRequestPanel],
  );

  const deleteRequests = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (!uniqueIds.length) {
        return;
      }
      await bulkApi.bulkDelete('requests', uniqueIds);
      const idSet = new Set(uniqueIds);
      setRequests((prev) => prev.filter((r) => !idSet.has(r.id)));
      if (currentRequest?.id && idSet.has(String(currentRequest.id))) {
        closeRequestPanel();
      }
      clearRequestSelection();
    },
    [clearRequestSelection, closeRequestPanel, currentRequest],
  );

  const getDeleteMessage = useCallback(
    (item: Request | null) =>
      `Delete "${item?.title || 'this request'}"? This action cannot be undone.`,
    [],
  );

  const requestsOrderedByDate = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [requests],
  );

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(requestsOrderedByDate, currentRequest, openRequestForView);

  const value: RequestsContextType = {
    isRequestPanelOpen,
    currentRequest,
    panelMode,
    validationErrors,
    requests,
    requestsContentView,
    requestTypes,
    saveRequestTypes,
    isSaving,
    refreshRequests: loadRequests,
    openRequestPanel,
    openRequestForEdit,
    openRequestForView,
    openRequestSettings,
    closeRequestSettingsView,
    closeRequestPanel,
    saveRequest,
    createRequest,
    deleteRequest,
    deleteRequests,
    selectedRequestIds,
    toggleRequestSelected,
    selectAllRequests,
    mergeIntoRequestSelection,
    clearRequestSelection,
    selectedCount,
    isSelected,
    clearValidationErrors,
    getDeleteMessage,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  };

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}
