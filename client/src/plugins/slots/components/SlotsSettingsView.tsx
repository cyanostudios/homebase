// Slots settings as full-page content (like Core Settings): tab row + card + footer.

import { Check, LayoutGrid, List, Plus, Tag, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useSlotSettings } from '../hooks/useSlotSettings';
import type { SlotsViewMode } from '../types/slots';

const slotsSettingsCategories = [
  { id: 'view', label: 'View', icon: LayoutGrid },
  { id: 'categories', label: 'Categories', icon: Tag },
];

const viewModes: {
  id: SlotsViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
];

type SlotsSettingsCategory = 'view' | 'categories';

interface SlotsSettingsViewProps {
  selectedCategory?: SlotsSettingsCategory;
  onSelectedCategoryChange?: (category: SlotsSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function SlotsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: SlotsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { viewMode, setViewMode, tags, setTags, isDirty, isLoading, isSaving, save } =
    useSlotSettings();
  const [internalSelectedCategory, setInternalSelectedCategory] =
    useState<SlotsSettingsCategory>('view');
  const [newTag, setNewTag] = useState('');
  const activeCategory = selectedCategory ?? internalSelectedCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalSelectedCategory;

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {slotsSettingsCategories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setActiveCategory(category.id as SlotsSettingsCategory)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.label}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeCategory, setActiveCategory],
  );

  const addTag = useCallback(() => {
    const next = newTag.trim();
    if (!next) {
      return;
    }
    const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (exists) {
      setNewTag('');
      return;
    }
    setTags((prev) => [...prev, next]);
    setNewTag('');
  }, [newTag, tags, setTags]);

  const removeTag = useCallback(
    (tag: string) => {
      setTags((prev) => prev.filter((t) => t !== tag));
    },
    [setTags],
  );

  useEffect(() => {
    if (renderCategoryButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(categoryButtons);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, renderCategoryButtonsInline, categoryButtons]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {renderCategoryButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              Slots - Settings
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {categoryButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">Slots - Settings</h2>
      )}
      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        {activeCategory === 'view' && (
          <DetailSection title="Default view" className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {viewModes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = viewMode === mode.id;
                return (
                  <Button
                    key={mode.id}
                    variant="ghost"
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium',
                      'flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{mode.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Slots will be displayed in the selected layout by default.
            </p>
          </DetailSection>
        )}

        {activeCategory === 'categories' && (
          <DetailSection title="Categories" className="pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Categories can be assigned to slots in Slot form.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a category (e.g. VIP, Stand A)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="h-9 text-xs px-3"
                >
                  Add
                </Button>
              </div>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                      <span>{tag}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove category ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </DetailSection>
        )}
      </Card>

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={save}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
