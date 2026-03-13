// Slots settings as full-page content (like Core Settings): tab row + card + footer.

import { Check, LayoutGrid, List } from 'lucide-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useSlotSettings } from '../hooks/useSlotSettings';
import type { SlotsViewMode } from '../types/slots';

const slotsSettingsCategories = [{ id: 'view', label: 'View', icon: LayoutGrid }];

const viewModes: {
  id: SlotsViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
];

export function SlotsSettingsView() {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { viewMode, setViewMode, isDirty, isLoading, isSaving, save } = useSlotSettings();

  useEffect(() => {
    setHeaderTrailing(
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {slotsSettingsCategories.map((category) => {
          const Icon = category.icon;
          const isActive = category.id === 'view';
          return (
            <Button
              key={category.id}
              variant="ghost"
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
      </div>,
    );
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <Card
        padding="md"
        className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
      >
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
