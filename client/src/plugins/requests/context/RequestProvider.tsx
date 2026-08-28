import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { requestsApi } from '../api/requestsApi';
import type { RequestPayload } from '../api/requestsApi';
import { RequestDetailHeaderMenus } from '../components/RequestDetailHeaderMenus';
import { DEFAULT_REQUEST_TYPES, isRequestUnopened } from '../types/requests';
import type { Request, RequestValidationError } from '../types/requests';
import { shouldApplyOpenRequestSaveEffects } from '../utils/requestListSave';
import { coerceRequestTypes, type RequestTypeConfig } from '../utils/requestTypeConfig';

const REQUESTS_SETTINGS_KEY = 'requests';
const DEFAULT_REQUEST_TYPE_CONFIGS: RequestTypeConfig[] = DEFAULT_REQUEST_TYPES.map((key) => ({
  key,
}));

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
  const navigate = useNavigate();
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    getSettings,
    updateSettings,
    setNavBadge,
  } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/requests');

  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<RequestValidationError>();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [requestsContentView, setRequestsContentView] = useState<'list' | 'settings'>('list');
  const [requestTypes, setRequestTypes] = useState<RequestTypeConfig[]>(
    DEFAULT_REQUEST_TYPE_CONFIGS,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    getSettings(REQUESTS_SETTINGS_KEY).then((s: any) => {
      const coerced = coerceRequestTypes(s?.requestTypes);
      if (coerced.length > 0) {
        setRequestTypes(coerced);
      }
    });
  }, [isAuthenticated, getSettings]);

  const saveRequestTypes = useCallback(
    async (types: RequestTypeConfig[]) => {
      const coerced = coerceRequestTypes(types);
      setRequestTypes(coerced);
      await updateSettings(REQUESTS_SETTINGS_KEY, { requestTypes: coerced });
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

  useEffect(() => {
    if (!isAuthenticated) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await requestsApi.getRequests();
        if (!cancelled) {
          setRequests(data);
        }
      } catch (error: any) {
        if (!cancelled) {
          setValidationErrors([
            { field: 'general', message: error?.message || 'Failed to load requests' },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors]);

  const loadRequests = useCallback(async () => {
    setRequests(await requestsApi.getRequests());
  }, []);

  const markRequestViewed = useCallback(
    async (id: string) => {
      const requestId = String(id);
      const existing = requests.find((request) => request.id === requestId);
      if (!existing || !isRequestUnopened(existing)) {
        return;
      }

      const optimisticViewedAt = new Date().toISOString();
      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId ? { ...request, firstViewedAt: optimisticViewedAt } : request,
        ),
      );
      if (currentRequest?.id === requestId) {
        setCurrentRequest((prev) => (prev ? { ...prev, firstViewedAt: optimisticViewedAt } : prev));
      }

      try {
        const updated = await requestsApi.markViewed(requestId);
        setRequests((prev) =>
          prev.map((request) => (request.id === requestId ? updated : request)),
        );
        if (currentRequest?.id === requestId) {
          setCurrentRequest(updated);
        }
      } catch (error) {
        console.error('Failed to mark request viewed:', error);
        setRequests((prev) =>
          prev.map((request) =>
            request.id === requestId ? { ...request, firstViewedAt: null } : request,
          ),
        );
        if (currentRequest?.id === requestId) {
          setCurrentRequest((prev) => (prev ? { ...prev, firstViewedAt: null } : prev));
        }
      }
    },
    [currentRequest?.id, requests],
  );

  const unopenedCount = useMemo(
    () => requests.filter((request) => isRequestUnopened(request)).length,
    [requests],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNavBadge('requests', null);
      return;
    }
    if (unopenedCount > 0) {
      setNavBadge('requests', {
        label: String(unopenedCount),
        variant: 'destructive',
      });
    } else {
      setNavBadge('requests', null);
    }
    return () => setNavBadge('requests', null);
  }, [isAuthenticated, setNavBadge, unopenedCount]);

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

  const requestsDeepLinkPathSyncedRef = useRef<string | null>(null);

  const openRequestPanel = useCallback(
    (request: Request | null) => {
      clearRequestSelection();
      setCurrentRequest(request);
      setPanelMode(request ? 'edit' : 'create');
      setIsRequestPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (request) {
        const slug = buildSlug(request, requests, 'title');
        requestsDeepLinkPathSyncedRef.current = `/requests/${slug}`;
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
      const slug = buildSlug(request, requests, 'title');
      requestsDeepLinkPathSyncedRef.current = `/requests/${slug}`;
      navigateToItem(request, requests, 'title');
    },
    [navigateToItem, requests, onCloseOtherPanels, setValidationErrors],
  );

  const openRequestForViewRef = useRef<(request: Request) => void>(() => {});
  const openRequestForView = useCallback(
    (request: Request) => {
      void markRequestViewed(request.id);
      if (!window.location.pathname.startsWith('/requests')) {
        navigate(`/requests/${buildSlug(request, requests, 'title')}`);
        return;
      }
      setCurrentRequest(request);
      setPanelMode('view');
      setIsRequestPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(request, requests, 'title');
    },
    [
      markRequestViewed,
      navigate,
      navigateToItem,
      requests,
      onCloseOtherPanels,
      setValidationErrors,
    ],
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
      requestsDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (requestsDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, requests, 'title');
    requestsDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openRequestForViewRef.current(item as Request);
    }
  }, [location.pathname, requests]);

  const createRequest = useCallback(
    async (data: RequestPayload): Promise<Request> => {
      const created = await requestsApi.createRequest({
        request_type: requestTypes[0]?.key ?? DEFAULT_REQUEST_TYPES[0],
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
          if (shouldApplyOpenRequestSaveEffects(currentRequest?.id, id)) {
            setCurrentRequest(updated);
            setPanelMode('view');
          }
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

  const sendRequestToList = useCallback(
    async (id: string): Promise<Request> => {
      const { request: updated } = await requestsApi.sendToList(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      if (currentRequest?.id === id) {
        setCurrentRequest(updated);
      }
      return updated;
    },
    [currentRequest],
  );

  const getDeleteMessage = useCallback(
    (item: Request | null) =>
      `Delete "${item?.title || 'this request'}"? This action cannot be undone.`,
    [],
  );

  const getPanelTitle = useCallback((mode: string, item: Request | null) => {
    if (mode === 'view' && item) {
      return <RequestDetailHeaderMenus key={String(item.id)} request={item} />;
    }
    return null;
  }, []);

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
    unopenedCount,
    markRequestViewed,
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
    sendRequestToList,
    selectedRequestIds,
    toggleRequestSelected,
    selectAllRequests,
    mergeIntoRequestSelection,
    clearRequestSelection,
    selectedCount,
    isSelected,
    clearValidationErrors,
    getPanelTitle,
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
