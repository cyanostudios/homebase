import { Grip, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import { instructionsApi } from '../api/instructionsApi';
import type { InstructionSettingsTab } from '../context/InstructionContext';
import { useInstructions } from '../hooks/useInstructions';
import type { InstructionCategory } from '../types/instructions';
import {
  getInitialInstructionColumnCount,
  INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY,
  INSTRUCTIONS_SETTINGS_KEY,
  resolveInstructionColumnCount,
  type InstructionColumnCount,
} from '../utils/instructionColumnCount';

const COLUMN_OPTIONS: InstructionColumnCount[] = [1, 2, 3];

interface InstructionSettingsViewProps {
  selectedTab?: InstructionSettingsTab;
  onSelectedTabChange?: (tab: InstructionSettingsTab) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderTabButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function InstructionSettingsView({
  selectedTab,
  onSelectedTabChange,
  inlineTrailing,
}: InstructionSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { categories, refreshCategories, instructionsSettingsTab } = useInstructions();

  const [internalTab, setInternalTab] = useState<InstructionSettingsTab>('view');
  const activeTab = selectedTab ?? internalTab;
  const setActiveTab = onSelectedTabChange ?? setInternalTab;

  const [columnCount, setColumnCount] = useState<InstructionColumnCount>(
    getInitialInstructionColumnCount,
  );
  const [initialColumnCount, setInitialColumnCount] = useState<InstructionColumnCount>(
    getInitialInstructionColumnCount,
  );
  const [draftCategories, setDraftCategories] = useState<InstructionCategory[]>([]);
  const [initialCategoryIds, setInitialCategoryIds] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shellCategories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('instructions.settings.tabs.view'),
        description: t('instructions.settings.tabs.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'categories',
        label: t('instructions.settings.tabs.categories'),
        description: t('instructions.settings.tabs.categoriesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.categories,
        dotClassName: 'bg-amber-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    setActiveTab(instructionsSettingsTab);
  }, [instructionsSettingsTab, setActiveTab]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([getSettings(INSTRUCTIONS_SETTINGS_KEY), refreshCategories()])
      .then(([settings]) => {
        if (cancelled) return;
        const next = resolveInstructionColumnCount(settings);
        setColumnCount(next);
        setInitialColumnCount(next);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t('instructions.settings.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, refreshCategories, t]);

  useEffect(() => {
    setDraftCategories(categories);
    setInitialCategoryIds(categories.map((c) => c.id));
  }, [categories]);

  const addCategory = useCallback(() => {
    const next = newCategory.trim();
    if (!next) return;
    const exists = draftCategories.some((c) => c.name.toLowerCase() === next.toLowerCase());
    if (exists) {
      setNewCategory('');
      return;
    }
    setDraftCategories((prev) => [
      ...prev,
      {
        id: `new:${next.toLowerCase()}`,
        name: next,
        sortOrder: prev.length + 1,
      },
    ]);
    setNewCategory('');
  }, [draftCategories, newCategory]);

  const removeCategory = useCallback((id: string) => {
    setDraftCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const categoriesDirty = useMemo(() => {
    const draftIds = draftCategories.map((c) => c.id);
    if (draftIds.length !== initialCategoryIds.length) return true;
    return draftIds.some((id, idx) => id !== initialCategoryIds[idx] || id.startsWith('new:'));
  }, [draftCategories, initialCategoryIds]);

  const isDirty = columnCount !== initialColumnCount || categoriesDirty;

  const save = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (columnCount !== initialColumnCount) {
        await updateSettings(INSTRUCTIONS_SETTINGS_KEY, { columnCount });
        setInitialColumnCount(columnCount);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        }
      }

      if (categoriesDirty) {
        const existingIds = new Set(initialCategoryIds);
        const draftExistingIds = new Set(
          draftCategories.filter((c) => !c.id.startsWith('new:')).map((c) => c.id),
        );
        for (const id of existingIds) {
          if (!draftExistingIds.has(id)) {
            await instructionsApi.deleteCategory(id);
          }
        }
        const createdIdByTemp = new Map<string, string>();
        for (const cat of draftCategories) {
          if (cat.id.startsWith('new:')) {
            const created = await instructionsApi.createCategory(cat.name);
            createdIdByTemp.set(cat.id, created.id);
          }
        }
        const orderedIds = draftCategories.map((c) =>
          c.id.startsWith('new:') ? (createdIdByTemp.get(c.id) as string) : c.id,
        );
        if (orderedIds.length > 0) {
          await instructionsApi.reorderCategories(orderedIds);
        }
        await refreshCategories();
      }
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string };
      setErrorMessage(err?.message || err?.error || t('instructions.settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [
    categoriesDirty,
    columnCount,
    draftCategories,
    initialCategoryIds,
    initialColumnCount,
    refreshCategories,
    t,
    updateSettings,
  ]);

  const reorderCategories = useCallback(
    async (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;

      const fromIndex = draftCategories.findIndex((c) => c.id === sourceId);
      const toIndex = draftCategories.findIndex((c) => c.id === targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return;
      }

      const rollback = draftCategories;
      const nextOrder = [...draftCategories];
      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, moved);
      setDraftCategories(nextOrder);

      // Only persist immediately when no pending add/remove (all real ids)
      const canPersistNow =
        nextOrder.every((c) => !c.id.startsWith('new:')) &&
        nextOrder.length === initialCategoryIds.length &&
        nextOrder.every((c) => initialCategoryIds.includes(c.id));

      if (!canPersistNow) {
        return;
      }

      setIsReordering(true);
      setErrorMessage(null);
      try {
        const rows = await instructionsApi.reorderCategories(nextOrder.map((c) => c.id));
        setDraftCategories(rows);
        setInitialCategoryIds(rows.map((c) => c.id));
        await refreshCategories();
      } catch (error: unknown) {
        setDraftCategories(rollback);
        const err = error as { message?: string; error?: string };
        setErrorMessage(err?.message || err?.error || t('instructions.settings.saveFailed'));
      } finally {
        setIsReordering(false);
      }
    },
    [draftCategories, initialCategoryIds, refreshCategories, t],
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingId && draggingId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    if (sourceId) {
      await reorderCategories(sourceId, targetId);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('instructions.settings.title')}
      subtitle={t('instructions.settingsSubtitle')}
      categories={shellCategories}
      activeCategory={activeTab}
      onCategoryChange={(id) => setActiveTab(id as InstructionSettingsTab)}
      trailing={inlineTrailing}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void save()} isSaving={isSaving} />
        ) : null
      }
    >
      {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

      {activeTab === 'view' && (
        <DetailSection title={t('instructions.settings.defaultColumns')} className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {COLUMN_OPTIONS.map((count) => {
              const isActive = columnCount === count;
              return (
                <Button
                  key={count}
                  variant="ghost"
                  onClick={() => setColumnCount(count)}
                  className={cn(
                    'h-9 text-xs px-3 rounded-lg font-medium',
                    'flex items-center gap-1.5',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                  )}
                  aria-label={t(`instructions.columns${count}`)}
                  aria-pressed={isActive}
                >
                  <span>{count}</span>
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('instructions.settings.columnsHelp')}
          </p>
        </DetailSection>
      )}

      {activeTab === 'categories' && (
        <DetailSection title={t('instructions.settings.categoriesSection')} className="pt-0">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('instructions.settings.categoriesHint')}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t('instructions.settings.addCategoryPlaceholder')}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={addCategory}
                disabled={!newCategory.trim()}
                className="h-9 text-xs px-3"
              >
                {t('instructions.settings.addCategory')}
              </Button>
            </div>
            {draftCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('instructions.settings.noCategories')}
              </p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
                {draftCategories.map((cat) => (
                  <li
                    key={cat.id}
                    draggable={!isReordering}
                    onDragStart={(e) => handleDragStart(e, cat.id)}
                    onDragOver={(e) => handleDragOver(e, cat.id)}
                    onDrop={(e) => void handleDrop(e, cat.id)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={() => {
                      if (dragOverId === cat.id) setDragOverId(null);
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                      draggingId === cat.id && 'opacity-50',
                      dragOverId === cat.id && 'bg-muted/60',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Grip
                        className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                        aria-hidden
                      />
                      <span className="truncate text-sm font-medium">{cat.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 min-w-7 p-0 rounded hover:bg-muted"
                      onClick={() => removeCategory(cat.id)}
                      aria-label={t('instructions.settings.removeCategory', { name: cat.name })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
