// Guides settings: same embedding pattern as Notes/Tasks (inline header + category tabs + card).

import { BookOpen, Timer } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { cn } from '@/lib/utils';

import { ContentSourcesSettings } from './ContentSourcesSettings';
import { ProductionWorkerSettingsPanel } from './ProductionWorkerSettingsPanel';

export type GuideSettingsCategory = 'production' | 'sources';

interface GuideSettingsCategoryDef {
  id: GuideSettingsCategory;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GUIDE_SETTINGS_CATEGORIES: GuideSettingsCategoryDef[] = [
  { id: 'production', labelKey: 'guides.settings.categories.production', icon: Timer },
  { id: 'sources', labelKey: 'guides.settings.categories.sources', icon: BookOpen },
];

interface GuideSettingsViewProps {
  selectedCategory?: GuideSettingsCategory;
  onSelectedCategoryChange?: (category: GuideSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function GuideSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: GuideSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();

  const [internalCategory, setInternalCategory] = useState<GuideSettingsCategory>('production');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {GUIDE_SETTINGS_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setActiveCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t(category.labelKey)}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeCategory, setActiveCategory, t],
  );

  React.useEffect(() => {
    if (renderCategoryButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(categoryButtons);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, renderCategoryButtonsInline, categoryButtons]);

  const settingsTitle = t('guides.settingsTitle');

  return (
    <div className="space-y-4">
      {renderCategoryButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              {settingsTitle}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {categoryButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">{settingsTitle}</h2>
      )}

      <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        {activeCategory === 'production' && <ProductionWorkerSettingsPanel />}
        {activeCategory === 'sources' && <ContentSourcesSettings />}
      </Card>
    </div>
  );
}
