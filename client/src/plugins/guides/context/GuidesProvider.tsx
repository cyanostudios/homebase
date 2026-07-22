import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { guidesApi } from '../api/guidesApi';
import type {
  Guide,
  GuidePayload,
  GuideValidationError,
  ProductionJobDetail,
} from '../types/guides';

import { GuidesContext, type GuideSaveOptions, type GuidesContextType } from './GuidesContext';

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
  const { t } = useTranslation();
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
  const [pendingProductionDetail, setPendingProductionDetail] =
    useState<ProductionJobDetail | null>(null);
  const pendingProductionDetailRef = useRef<ProductionJobDetail | null>(null);

  const consumePendingProductionDetail = useCallback(() => {
    const detail = pendingProductionDetailRef.current;
    pendingProductionDetailRef.current = null;
    setPendingProductionDetail(null);
    return detail;
  }, []);

  const {
    selectedIds: selectedGuideIds,
    toggleSelection: toggleGuideSelectedCore,
    selectAll: selectAllGuidesCore,
    mergeIntoSelection: mergeIntoGuideSelectionCore,
    clearSelection: clearGuideSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

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
          setValidationErrors([{ field: 'general', message: t('guides.loadFailed') }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors, t]);

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

  const validate = useCallback(
    (data: GuidePayload): GuideValidationError[] => {
      const errors: GuideValidationError[] = [];
      if (!data.displayName.trim()) {
        errors.push({ field: 'displayName', message: t('guides.displayNameRequired') });
      }
      return errors;
    },
    [t],
  );

  const saveGuide = useCallback(
    async (raw: GuidePayload, options?: GuideSaveOptions): Promise<boolean> => {
      const produce = Boolean(options?.produce);
      const payload: GuidePayload = {
        displayName: raw.displayName.trim(),
        shortIntro: raw.shortIntro?.trim() ? raw.shortIntro.trim() : null,
        geographicReference: raw.geographicReference?.trim()
          ? raw.geographicReference.trim()
          : null,
        place: raw.place ?? null,
        lifecycleStatus: raw.lifecycleStatus ?? 'draft',
        sourceLanguage: raw.sourceLanguage?.trim() ? raw.sourceLanguage.trim().toLowerCase() : 'en',
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
            place: payload.place,
            lifecycleStatus: payload.lifecycleStatus,
            sourceLanguage: payload.sourceLanguage,
            masterGuideEditorialStatus: raw.masterGuideEditorialStatus,
          });
          setGuides((prev) => prev.map((g) => (g.id === currentGuide.id ? saved : g)));
          setCurrentGuide(saved);
          setPanelMode('view');
        } else {
          const saved = await guidesApi.createGuide(payload);
          const nextGuides = [saved, ...guides.filter((g) => String(g.id) !== String(saved.id))];
          setGuides(nextGuides);

          if (produce) {
            const sourceLanguage = saved.sourceLanguage?.trim().toLowerCase() || 'en';
            try {
              const detail = await guidesApi.startProductionJob(saved.id, {
                type: 'full_guide',
                phases: ['text_derivation'],
                languages: [sourceLanguage],
              });
              pendingProductionDetailRef.current = detail;
              setPendingProductionDetail(detail);
            } catch (produceErr) {
              console.error('Failed to start guide production after create:', produceErr);
              const status = (produceErr as { status?: number }).status;
              const code = (produceErr as { code?: string }).code;
              if (status === 422 && code) {
                setValidationErrors([
                  {
                    field: 'general',
                    message: t(`guides.generation.failure.${code}.title`, {
                      defaultValue: t('guides.production.actionFailed'),
                    }),
                  },
                ]);
              } else {
                setValidationErrors([
                  { field: 'general', message: t('guides.production.actionFailed') },
                ]);
              }
              setCurrentGuide(saved);
              setPanelMode('view');
              setIsGuidePanelOpen(true);
              onCloseOtherPanels();
              navigateToItem(saved, nextGuides, 'displayName');
              return true;
            }

            setCurrentGuide(saved);
            setPanelMode('view');
            setIsGuidePanelOpen(true);
            clearValidationErrors();
            onCloseOtherPanels();
            navigateToItem(saved, nextGuides, 'displayName');
          } else {
            closeGuidePanel();
          }
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: GuideValidationError[] };
        console.error('Failed to save guide place:', err);
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: t('guides.saveFailed') }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      closeGuidePanel,
      currentGuide,
      guides,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
      t,
      validate,
    ],
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
        setValidationErrors([{ field: 'general', message: t('guides.deletePlaceFailed') }]);
      }
    },
    [closeGuidePanel, currentGuide?.id, setValidationErrors, t],
  );

  const deleteGuides = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
      if (uniqueIds.length === 0) {
        return;
      }

      try {
        for (const id of uniqueIds) {
          await guidesApi.deleteGuide(id);
        }
        const idSet = new Set(uniqueIds);
        setGuides((prev) => prev.filter((g) => !idSet.has(String(g.id))));
        if (currentGuide?.id && idSet.has(String(currentGuide.id))) {
          closeGuidePanel();
        }
        clearGuideSelectionCore();
      } catch (err) {
        console.error('Failed to bulk delete guide places:', err);
        setValidationErrors([{ field: 'general', message: t('guides.deletePlaceFailed') }]);
      }
    },
    [clearGuideSelectionCore, closeGuidePanel, currentGuide?.id, setValidationErrors, t],
  );

  const toggleGuideSelected = useCallback(
    (id: string) => {
      toggleGuideSelectedCore(id);
    },
    [toggleGuideSelectedCore],
  );

  const selectAllGuides = useCallback(
    (ids: string[]) => {
      selectAllGuidesCore(ids);
    },
    [selectAllGuidesCore],
  );

  const mergeIntoGuideSelection = useCallback(
    (ids: string[]) => {
      mergeIntoGuideSelectionCore(ids);
    },
    [mergeIntoGuideSelectionCore],
  );

  const clearGuideSelection = useCallback(() => {
    clearGuideSelectionCore();
  }, [clearGuideSelectionCore]);

  const value = useMemo<GuidesContextType>(
    () => ({
      isGuidePanelOpen,
      currentGuide,
      panelMode,
      validationErrors,
      guides,
      isSaving,
      pendingProductionDetail,
      consumePendingProductionDetail,
      openGuidePanel,
      openGuideForEdit,
      openGuideForView,
      closeGuidePanel,
      saveGuide,
      deleteGuide,
      deleteGuides,
      selectedGuideIds,
      toggleGuideSelected,
      mergeIntoGuideSelection,
      selectAllGuides,
      clearGuideSelection,
      selectedCount,
      isSelected,
      clearValidationErrors,
    }),
    [
      isGuidePanelOpen,
      currentGuide,
      panelMode,
      validationErrors,
      guides,
      isSaving,
      pendingProductionDetail,
      consumePendingProductionDetail,
      openGuidePanel,
      openGuideForEdit,
      openGuideForView,
      closeGuidePanel,
      saveGuide,
      deleteGuide,
      deleteGuides,
      selectedGuideIds,
      toggleGuideSelected,
      mergeIntoGuideSelection,
      selectAllGuides,
      clearGuideSelection,
      selectedCount,
      isSelected,
      clearValidationErrors,
    ],
  );

  return <GuidesContext.Provider value={value}>{children}</GuidesContext.Provider>;
}
