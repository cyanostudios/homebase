import { Check, Grip, LayoutGrid, Plus, Tag, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
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

const SETTINGS_TABS: Array<{
  id: InstructionSettingsTab;
  labelKey: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'view', labelKey: 'instructions.settings.tabs.view', icon: LayoutGrid },
  { id: 'categories', labelKey: 'instructions.settings.tabs.categories', icon: Tag },
];

interface InstructionSettingsViewProps {
  selectedTab?: InstructionSettingsTab;
  onSelectedTabChange?: (tab: InstructionSettingsTab) => void;
  renderTabButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function InstructionSettingsView({
  selectedTab,
  onSelectedTabChange,
  renderTabButtonsInline = false,
  inlineTrailing,
}: InstructionSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
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

  const tabButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => !isActive && setActiveTab(tab.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t(tab.labelKey)}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeTab, setActiveTab, t],
  );

  useEffect(() => {
    if (renderTabButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(tabButtons);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, renderTabButtonsInline, tabButtons]);

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

      let nextOrder: InstructionCategory[] | null = null;
      let rollback: InstructionCategory[] | null = null;

      setDraftCategories((prev) => {
        const fromIndex = prev.findIndex((c) => c.id === sourceId);
        const toIndex = prev.findIndex((c) => c.id === targetId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        nextOrder = next;
        rollback = prev;
        return next;
      });

      if (!nextOrder || !rollback) return;

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
    [initialCategoryIds, refreshCategories, t],
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
    <div className="space-y-4">
      {renderTabButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              {t('instructions.settings.title')}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {tabButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">{t('instructions.settings.title')}</h2>
      )}

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
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
      </Card>

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void save()}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
