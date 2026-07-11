import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { guidesApi } from '../api/guidesApi';
import type { Guide, GuidePayload, GuideValidationError } from '../types/guides';

import { GuidesContext, type GuidesContextType } from './GuidesContext';

interface GuidesProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function GuidesProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: GuidesProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/guides');

  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false);
  const [currentGuide, setCurrentGuide] = useState<Guide | null>(null);
  const [panelMode, setPanelMode] = useState<GuidesContextType['panelMode']>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<GuideValidationError>();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setGuides([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await guidesApi.getGuides();
        if (!cancelled) {
          setGuides(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load guides:', err);
          setValidationErrors([{ field: 'general', message: 'Failed to load places.' }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors]);

  const closeGuidePanel = useCallback(() => {
    setIsGuidePanelOpen(false);
    setCurrentGuide(null);
    setPanelMode('create');
    clearValidationErrors();
    navigateToBase();
  }, [clearValidationErrors, navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('guides', closeGuidePanel);
    return () => unregisterPanelCloseFunction('guides');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeGuidePanel]);

  const openGuidePanel = useCallback(
    (item: Guide | null) => {
      setCurrentGuide(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsGuidePanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      if (item) {
        navigateToItem(item, guides, 'displayName');
      }
    },
    [clearValidationErrors, guides, navigateToItem, onCloseOtherPanels],
  );

  const openGuideForEdit = useCallback(
    (item: Guide) => {
      setCurrentGuide(item);
      setPanelMode('edit');
      setIsGuidePanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, guides, 'displayName');
    },
    [clearValidationErrors, guides, navigateToItem, onCloseOtherPanels],
  );

  const openGuideForViewRef = useRef<(item: Guide) => void>(() => {});
  const openGuideForView = useCallback(
    (item: Guide) => {
      if (!window.location.pathname.startsWith('/guides')) {
        navigate(`/guides/${buildSlug(item, guides, 'displayName')}`);
        return;
      }
      setCurrentGuide(item);
      setPanelMode('view');
      setIsGuidePanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, guides, 'displayName');
    },
    [clearValidationErrors, guides, navigate, navigateToItem, onCloseOtherPanels],
  );
  useEffect(() => {
    openGuideForViewRef.current = openGuideForView;
  }, [openGuideForView]);

  const guidesDeepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (guides.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'guides') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      guidesDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (guidesDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, guides, 'displayName');
    guidesDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openGuideForViewRef.current(item as Guide);
    }
  }, [location.pathname, guides]);

  const validate = useCallback((data: GuidePayload): GuideValidationError[] => {
    const errors: GuideValidationError[] = [];
    if (!data.displayName.trim()) {
      errors.push({ field: 'displayName', message: 'Display name is required' });
    }
    return errors;
  }, []);

  const saveGuide = useCallback(
    async (raw: GuidePayload): Promise<boolean> => {
      const payload: GuidePayload = {
        displayName: raw.displayName.trim(),
        shortIntro: raw.shortIntro?.trim() ? raw.shortIntro.trim() : null,
        geographicReference: raw.geographicReference?.trim()
          ? raw.geographicReference.trim()
          : null,
        lifecycleStatus: raw.lifecycleStatus ?? 'draft',
        sourceLanguage: raw.sourceLanguage?.trim() ? raw.sourceLanguage.trim().toLowerCase() : 'sv',
      };
      const errors = validate(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }

      try {
        setIsSaving(true);
        if (currentGuide) {
          const saved = await guidesApi.updateGuide(currentGuide.id, {
            displayName: payload.displayName,
            shortIntro: payload.shortIntro,
            geographicReference: payload.geographicReference,
            lifecycleStatus: payload.lifecycleStatus,
            sourceLanguage: payload.sourceLanguage,
            masterGuideEditorialStatus: raw.masterGuideEditorialStatus,
          });
          setGuides((prev) => prev.map((g) => (g.id === currentGuide.id ? saved : g)));
          setCurrentGuide(saved);
          setPanelMode('view');
        } else {
          const saved = await guidesApi.createGuide(payload);
          setGuides((prev) => [saved, ...prev]);
          closeGuidePanel();
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: GuideValidationError[] };
        console.error('Failed to save guide place:', err);
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: 'Failed to save. Please try again.' }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, closeGuidePanel, currentGuide, setValidationErrors, validate],
  );

  const deleteGuide = useCallback(
    async (id: string) => {
      try {
        await guidesApi.deleteGuide(id);
        setGuides((prev) => prev.filter((g) => g.id !== id));
        if (currentGuide?.id === id) {
          closeGuidePanel();
        }
      } catch (err) {
        console.error('Failed to delete guide place:', err);
      }
    },
    [closeGuidePanel, currentGuide?.id],
  );

  const value = useMemo<GuidesContextType>(
    () => ({
      isGuidePanelOpen,
      currentGuide,
      panelMode,
      validationErrors,
      guides,
      isSaving,
      openGuidePanel,
      openGuideForEdit,
      openGuideForView,
      closeGuidePanel,
      saveGuide,
      deleteGuide,
      clearValidationErrors,
    }),
    [
      isGuidePanelOpen,
      currentGuide,
      panelMode,
      validationErrors,
      guides,
      isSaving,
      openGuidePanel,
      openGuideForEdit,
      openGuideForView,
      closeGuidePanel,
      saveGuide,
      deleteGuide,
      clearValidationErrors,
    ],
  );

  return <GuidesContext.Provider value={value}>{children}</GuidesContext.Provider>;
}
