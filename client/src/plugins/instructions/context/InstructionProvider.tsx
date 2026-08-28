import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { buildSlug, resolveSlug, slugify } from '@/core/utils/slugUtils';

import { instructionsApi } from '../api/instructionsApi';
import { InstructionDetailHeaderMenus } from '../components/InstructionDetailHeaderMenus';
import type {
  Instruction,
  InstructionCategory,
  InstructionPayload,
  PublicationStatus,
  ValidationError,
} from '../types/instructions';
import { copyStepAt, reorderSteps } from '../utils/instructionStepOps';
import { hasDuplicateInstructionTitle } from '../utils/instructionTitleDuplicate';

import {
  InstructionContext,
  type InstructionContentView,
  type InstructionContextType,
  type InstructionSettingsTab,
} from './InstructionContext';

interface InstructionProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

function toPayload(
  instruction: Instruction,
  overrides?: Partial<InstructionPayload>,
): InstructionPayload {
  return {
    title: instruction.title,
    slug: instruction.slug,
    description: instruction.description,
    featuredImageUrl: instruction.featuredImageUrl,
    category: instruction.category,
    publicationStatus: instruction.publicationStatus,
    steps: (instruction.steps || []).map((step, index) => ({
      title: step.title,
      description: step.description ?? null,
      sequenceOrder: step.sequenceOrder ?? index + 1,
      imageUrl: step.imageUrl ?? null,
    })),
    ...overrides,
  };
}

export function InstructionProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: InstructionProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/instructions');

  const [isInstructionPanelOpen, setIsInstructionPanelOpen] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<Instruction | null>(null);
  const [panelMode, setPanelMode] = useState<InstructionContextType['panelMode']>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [categories, setCategories] = useState<InstructionCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [instructionsContentView, setInstructionsContentView] =
    useState<InstructionContentView>('list');
  const [instructionsSettingsTab, setInstructionsSettingsTab] =
    useState<InstructionSettingsTab>('');
  const [recentlyDuplicatedInstructionId, setRecentlyDuplicatedInstructionId] = useState<
    string | null
  >(null);

  const {
    selectedIds: selectedInstructionIds,
    toggleSelection: toggleInstructionSelectedCore,
    selectAll: selectAllInstructionsCore,
    mergeIntoSelection: mergeIntoInstructionSelectionCore,
    clearSelection: clearInstructionSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeInstructionPanel = useCallback(() => {
    setIsInstructionPanelOpen(false);
    setCurrentInstruction(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('instructions', closeInstructionPanel);
    return () => {
      unregisterPanelCloseFunction('instructions');
    };
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeInstructionPanel]);

  useEffect(() => {
    if (!isAuthenticated) {
      setInstructions([]);
      setCategories([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [rows, categoryRows] = await Promise.all([
          instructionsApi.getInstructions(),
          instructionsApi.getCategories(),
        ]);
        if (!cancelled) {
          setInstructions(rows);
          setCategories(categoryRows);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error('Failed to load instructions:', error);
          const err = error as { message?: string; error?: string };
          setValidationErrors([
            {
              field: 'general',
              message: err?.message || err?.error || 'Failed to load instructions',
            },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors]);

  const refreshCategories = useCallback(async () => {
    const categoryRows = await instructionsApi.getCategories();
    setCategories(categoryRows);
  }, []);

  const createInstructionCategory = useCallback(async (name: string) => {
    const created = await instructionsApi.createCategory(name);
    setCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === created.name.toLowerCase())) {
        return prev;
      }
      return [...prev, created].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
      );
    });
  }, []);

  const reorderInstructionCategories = useCallback(
    async (orderedIds: string[]) => {
      setCategories((prev) => {
        const byId = new Map(prev.map((c) => [String(c.id), c]));
        const next = orderedIds
          .map((id, index) => {
            const row = byId.get(String(id));
            return row ? { ...row, sortOrder: index + 1 } : null;
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        const used = new Set(next.map((c) => String(c.id)));
        const leftovers = prev.filter((c) => !used.has(String(c.id)));
        return [...next, ...leftovers];
      });
      try {
        const rows = await instructionsApi.reorderCategories(orderedIds);
        setCategories(rows);
      } catch (error) {
        try {
          await refreshCategories();
        } catch {
          /* keep optimistic order */
        }
        throw error;
      }
    },
    [refreshCategories],
  );

  const deleteInstructionCategory = useCallback(
    async (categoryId: string, options?: { moveToCategory: string | null }) => {
      const removed = categories.find((c) => String(c.id) === String(categoryId));
      const removedKey = (removed?.name || '').trim().toLowerCase();
      await instructionsApi.deleteCategory(categoryId, options);
      setCategories((prev) => prev.filter((c) => String(c.id) !== String(categoryId)));
      if (removedKey && Object.prototype.hasOwnProperty.call(options || {}, 'moveToCategory')) {
        const moveTo = options?.moveToCategory ?? null;
        setInstructions((prev) =>
          prev.map((row) =>
            (row.category || '').trim().toLowerCase() === removedKey
              ? { ...row, category: moveTo }
              : row,
          ),
        );
      }
    },
    [categories],
  );

  const openInstructionSettings = useCallback(
    (options?: { tab?: InstructionSettingsTab }) => {
      clearInstructionSelectionCore();
      setRecentlyDuplicatedInstructionId(null);
      setIsInstructionPanelOpen(false);
      setCurrentInstruction(null);
      setPanelMode('create');
      setValidationErrors([]);
      setInstructionsSettingsTab(options?.tab ?? '');
      setInstructionsContentView('settings');
      onCloseOtherPanels();
      navigateToBase();
    },
    [clearInstructionSelectionCore, navigateToBase, onCloseOtherPanels, setValidationErrors],
  );

  const closeInstructionSettingsView = useCallback(() => {
    setInstructionsContentView('list');
  }, []);

  const ensureFullInstruction = useCallback(async (item: Instruction): Promise<Instruction> => {
    if (Array.isArray(item.steps)) {
      return item;
    }
    return instructionsApi.getInstruction(item.id);
  }, []);

  const openInstructionPanel = useCallback(
    (instruction: Instruction | null) => {
      clearInstructionSelectionCore();
      setRecentlyDuplicatedInstructionId(null);
      setInstructionsContentView('list');
      setCurrentInstruction(instruction);
      setPanelMode(instruction ? 'edit' : 'create');
      setIsInstructionPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (instruction) {
        navigateToItem(instruction, instructions, 'slug');
        void ensureFullInstruction(instruction).then((full) => {
          setCurrentInstruction(full);
          setInstructions((prev) =>
            prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
          );
        });
      }
    },
    [
      clearInstructionSelectionCore,
      ensureFullInstruction,
      instructions,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );

  const openInstructionForEdit = useCallback(
    (instruction: Instruction) => {
      clearInstructionSelectionCore();
      setRecentlyDuplicatedInstructionId(null);
      setInstructionsContentView('list');
      setCurrentInstruction(instruction);
      setPanelMode('edit');
      setIsInstructionPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(instruction, instructions, 'slug');
      void ensureFullInstruction(instruction).then((full) => {
        setCurrentInstruction(full);
        setInstructions((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      clearInstructionSelectionCore,
      ensureFullInstruction,
      instructions,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );

  const openInstructionForViewRef = useRef<(item: Instruction) => void>(() => {});
  const openInstructionForView = useCallback(
    (instruction: Instruction) => {
      if (!window.location.pathname.startsWith('/instructions')) {
        navigate(`/instructions/${buildSlug(instruction, instructions, 'slug')}`);
        return;
      }
      setRecentlyDuplicatedInstructionId(null);
      setInstructionsContentView('list');
      setCurrentInstruction(instruction);
      setPanelMode('view');
      setIsInstructionPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(instruction, instructions, 'slug');
      void ensureFullInstruction(instruction).then((full) => {
        setCurrentInstruction(full);
        setInstructions((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      ensureFullInstruction,
      instructions,
      navigate,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );
  useEffect(() => {
    openInstructionForViewRef.current = openInstructionForView;
  }, [openInstructionForView]);

  const deepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (instructions.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'instructions') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      deepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (deepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, instructions, 'slug');
    deepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openInstructionForViewRef.current(item as Instruction);
    }
  }, [location.pathname, instructions]);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(instructions, currentInstruction, openInstructionForView);

  const validate = useCallback(
    (data: InstructionPayload, excludeId?: string | null): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.title?.trim()) {
        errors.push({ field: 'title', message: t('instructions.titleRequired') });
      } else if (hasDuplicateInstructionTitle(instructions, data.title, excludeId)) {
        errors.push({ field: 'title', message: t('instructions.titleDuplicate') });
      }
      if (
        data.slug != null &&
        data.slug.trim() &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug.trim())
      ) {
        errors.push({ field: 'slug', message: t('instructions.slugInvalid') });
      }
      if (data.publicationStatus === 'published' && (!data.steps || data.steps.length === 0)) {
        errors.push({ field: 'steps', message: t('instructions.publishNeedsSteps') });
      }
      data.steps?.forEach((step, index) => {
        if (!step.title?.trim()) {
          errors.push({
            field: `steps.${index}.title`,
            message: t('instructions.stepTitleRequired', { number: index + 1 }),
          });
        }
      });
      return errors;
    },
    [instructions, t],
  );

  const saveInstruction = useCallback(
    async (raw: InstructionPayload): Promise<boolean> => {
      const slug =
        raw.slug?.trim() || slugify(raw.title.trim()) || `instruction-${Date.now().toString(36)}`;
      const payload: InstructionPayload = {
        title: raw.title.trim(),
        slug,
        description: raw.description?.trim() ? raw.description.trim() : null,
        featuredImageUrl: raw.featuredImageUrl?.trim() ? raw.featuredImageUrl.trim() : null,
        category: raw.category?.trim() ? raw.category.trim() : null,
        publicationStatus: raw.publicationStatus === 'published' ? 'published' : 'draft',
        steps: (raw.steps || []).map((step, index) => {
          const rawDesc = (step.description ?? '').trim();
          const description = rawDesc && rawDesc.replace(/<[^>]*>/g, '').trim() ? rawDesc : null;
          return {
            title: step.title.trim(),
            description,
            sequenceOrder: index + 1,
            imageUrl: step.imageUrl?.trim() ? step.imageUrl.trim() : null,
          };
        }),
      };

      const errors = validate(payload, currentInstruction?.id);
      setValidationErrors(errors);
      if (errors.some((e) => !e.message.includes('Warning'))) {
        return false;
      }

      try {
        setIsSaving(true);
        if (currentInstruction) {
          const saved = await instructionsApi.updateInstruction(currentInstruction.id, payload);
          setInstructions((prev) =>
            prev.map((row) =>
              String(row.id) === String(currentInstruction.id)
                ? { ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
                : row,
            ),
          );
          setCurrentInstruction(saved);
          setPanelMode('view');
        } else {
          const saved = await instructionsApi.createInstruction(payload);
          setInstructions((prev) => [
            { ...saved, stepCount: saved.steps?.length ?? saved.stepCount ?? 0 },
            ...prev,
          ]);
          setCurrentInstruction(saved);
          setPanelMode('view');
          setIsInstructionPanelOpen(true);
          navigateToItem(saved, [saved, ...instructions], 'slug');
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[]; message?: string; error?: string };
        console.error('Failed to save instruction:', err);
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([
            {
              field: 'general',
              message: error?.message || error?.error || t('instructions.saveFailed'),
            },
          ]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      currentInstruction,
      instructions,
      navigateToItem,
      setValidationErrors,
      t,
      validate,
    ],
  );

  const deleteInstruction = useCallback(
    async (id: string) => {
      try {
        await instructionsApi.deleteInstruction(id);
        setInstructions((prev) => prev.filter((row) => String(row.id) !== String(id)));
        if (isSelected(id)) {
          toggleInstructionSelectedCore(id);
        }
        if (currentInstruction && String(currentInstruction.id) === String(id)) {
          closeInstructionPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.deleteFailed'),
          },
        ]);
      }
    },
    [
      closeInstructionPanel,
      currentInstruction,
      isSelected,
      setValidationErrors,
      t,
      toggleInstructionSelectedCore,
    ],
  );

  const deleteInstructions = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
      if (!uniqueIds.length) {
        return;
      }
      try {
        try {
          await instructionsApi.deleteInstructionsBatch(uniqueIds);
        } catch {
          await bulkApi.bulkDelete('instructions', uniqueIds);
        }
        setInstructions((prev) => prev.filter((row) => !uniqueIds.includes(String(row.id))));
        clearInstructionSelectionCore();
        if (currentInstruction && uniqueIds.includes(String(currentInstruction.id))) {
          closeInstructionPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        console.error('Bulk delete failed:', error);
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.deleteFailed'),
          },
        ]);
      }
    },
    [
      clearInstructionSelectionCore,
      closeInstructionPanel,
      currentInstruction,
      setValidationErrors,
      t,
    ],
  );

  const updateInstructionPublicationStatus = useCallback(
    async (instruction: Instruction, status: PublicationStatus) => {
      try {
        const full = await ensureFullInstruction(instruction);
        if (status === 'published' && (!full.steps || full.steps.length === 0)) {
          setValidationErrors([{ field: 'steps', message: t('instructions.publishNeedsSteps') }]);
          return;
        }
        const saved = await instructionsApi.updateInstruction(
          full.id,
          toPayload(full, { publicationStatus: status }),
        );
        setInstructions((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentInstruction && String(currentInstruction.id) === String(saved.id)) {
          setCurrentInstruction(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.saveFailed'),
          },
        ]);
      }
    },
    [clearValidationErrors, currentInstruction, ensureFullInstruction, setValidationErrors, t],
  );

  const reorderInstructionSteps = useCallback(
    async (instruction: Instruction, fromIndex: number, direction: -1 | 1) => {
      const reordered = reorderSteps(instruction.steps || [], fromIndex, direction);
      if (!reordered) {
        return;
      }

      try {
        setIsSaving(true);
        const saved = await instructionsApi.updateInstruction(
          instruction.id,
          toPayload({ ...instruction, steps: reordered }),
        );
        setInstructions((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentInstruction && String(currentInstruction.id) === String(saved.id)) {
          setCurrentInstruction(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, currentInstruction, setValidationErrors, t],
  );

  const copyInstructionStep = useCallback(
    async (instruction: Instruction, index: number) => {
      const nextSteps = copyStepAt(instruction.steps || [], index);
      if (!nextSteps) {
        return;
      }

      try {
        setIsSaving(true);
        const saved = await instructionsApi.updateInstruction(
          instruction.id,
          toPayload({ ...instruction, steps: nextSteps }),
        );
        setInstructions((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentInstruction && String(currentInstruction.id) === String(saved.id)) {
          setCurrentInstruction(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, currentInstruction, setValidationErrors, t],
  );

  const reorderInstructionsInCategory = useCallback(
    async (category: string | null, orderedIds: string[]) => {
      try {
        setIsSaving(true);
        const rows = await instructionsApi.reorderInstructions(category, orderedIds);
        setInstructions(rows);
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('instructions.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, setValidationErrors, t],
  );

  const createInstructionDuplicate = useCallback(
    async (item: Instruction, newName: string): Promise<Instruction> => {
      const full = await ensureFullInstruction(item);
      const nextTitle = (newName ?? '').trim() || full.title?.trim() || 'Untitled';
      return instructionsApi.createInstruction({
        title: nextTitle,
        slug: slugify(nextTitle) || undefined,
        description: full.description,
        featuredImageUrl: full.featuredImageUrl,
        category: full.category,
        publicationStatus: 'draft',
        steps: (full.steps || []).map((step, index) => ({
          title: step.title,
          description: step.description ?? null,
          sequenceOrder: index + 1,
          imageUrl: step.imageUrl ?? null,
        })),
      });
    },
    [ensureFullInstruction],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Instruction) => `Copy of ${item.title?.trim() || 'Item'}`,
    nameLabel: t('instructions.title'),
    confirmOnly: false,
    createDuplicate: async (item, newName) => {
      const saved = await createInstructionDuplicate(item, newName);
      setInstructions((prev) => [
        { ...saved, stepCount: saved.steps?.length ?? saved.stepCount ?? 0 },
        ...prev,
      ]);
      return saved;
    },
    closePanel: closeInstructionPanel,
  });

  const getDeleteMessage = (item: Instruction | null) =>
    buildDeleteMessage(t, 'instructions', item?.title || undefined);

  const getPanelTitle = useCallback((mode?: string, item?: Instruction | null) => {
    if (mode !== 'view' || !item) {
      return null;
    }
    return <InstructionDetailHeaderMenus key={String(item.id)} instruction={item} />;
  }, []);

  const value = useMemo<InstructionContextType>(
    () => ({
      isInstructionPanelOpen,
      currentInstruction,
      panelMode,
      validationErrors,
      instructions,
      categories,
      refreshCategories,
      createInstructionCategory,
      reorderInstructionCategories,
      deleteInstructionCategory,
      isSaving,
      instructionsContentView,
      instructionsSettingsTab,
      openInstructionSettings,
      closeInstructionSettingsView,
      openInstructionPanel,
      openInstructionForEdit,
      openInstructionForView,
      closeInstructionPanel,
      saveInstruction,
      deleteInstruction,
      deleteInstructions,
      updateInstructionPublicationStatus,
      reorderInstructionSteps,
      copyInstructionStep,
      reorderInstructionsInCategory,
      getDuplicateConfig,
      executeDuplicate,
      clearValidationErrors,
      selectedInstructionIds,
      toggleInstructionSelected: toggleInstructionSelectedCore,
      selectAllInstructions: selectAllInstructionsCore,
      mergeIntoInstructionSelection: mergeIntoInstructionSelectionCore,
      clearInstructionSelection: clearInstructionSelectionCore,
      selectedCount,
      isSelected,
      getDeleteMessage,
      recentlyDuplicatedInstructionId,
      setRecentlyDuplicatedInstructionId,
      navigateToPrevItem,
      navigateToNextItem,
      hasPrevItem,
      hasNextItem,
      currentItemIndex,
      totalItems,
      getPanelTitle,
    }),
    [
      isInstructionPanelOpen,
      currentInstruction,
      panelMode,
      validationErrors,
      instructions,
      categories,
      refreshCategories,
      createInstructionCategory,
      reorderInstructionCategories,
      deleteInstructionCategory,
      isSaving,
      instructionsContentView,
      instructionsSettingsTab,
      openInstructionSettings,
      closeInstructionSettingsView,
      openInstructionPanel,
      openInstructionForEdit,
      openInstructionForView,
      closeInstructionPanel,
      saveInstruction,
      deleteInstruction,
      deleteInstructions,
      updateInstructionPublicationStatus,
      reorderInstructionSteps,
      copyInstructionStep,
      reorderInstructionsInCategory,
      getDuplicateConfig,
      executeDuplicate,
      clearValidationErrors,
      selectedInstructionIds,
      toggleInstructionSelectedCore,
      selectAllInstructionsCore,
      mergeIntoInstructionSelectionCore,
      clearInstructionSelectionCore,
      selectedCount,
      isSelected,
      recentlyDuplicatedInstructionId,
      navigateToPrevItem,
      navigateToNextItem,
      hasPrevItem,
      hasNextItem,
      currentItemIndex,
      totalItems,
      getPanelTitle,
      t,
    ],
  );

  return <InstructionContext.Provider value={value}>{children}</InstructionContext.Provider>;
}
