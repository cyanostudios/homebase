import { Check } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import {
  SettingsCategoryCard,
  type SettingsCategoryCardProps,
} from '@/core/ui/SettingsCategoryCard';
import { cn } from '@/lib/utils';

/** Green header Save matching Core Settings. */
export function SettingsHeaderSaveButton({
  onClick,
  isSaving = false,
  disabled = false,
  label,
  savingLabel,
}: {
  onClick: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  label?: string;
  savingLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="primary"
      size="sm"
      icon={Check}
      disabled={disabled || isSaving}
      className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
    >
      {isSaving ? (savingLabel ?? t('common.saving')) : (label ?? t('common.save'))}
    </Button>
  );
}

export type PluginSettingsCategory = Pick<
  SettingsCategoryCardProps,
  'id' | 'label' | 'description' | 'icon' | 'dotClassName'
>;

const MD_GRID_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export interface PluginSettingsPageShellProps {
  title: string;
  subtitle?: string;
  categories?: PluginSettingsCategory[];
  activeCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  /** Close (and any other non-save trailing controls). */
  trailing?: React.ReactNode;
  /** Save control shown in the header when dirty (Core Settings pattern). */
  saveAction?: React.ReactNode;
  /** When false, children are rendered without the DETAIL_VIEW card wrapper. */
  wrapContentInCard?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Full-page plugin settings shell matching Core Settings layout:
 * title + subtitle, optional Save + Close in header, category cards, detail content card.
 */
export function PluginSettingsPageShell({
  title,
  subtitle,
  categories,
  activeCategory,
  onCategoryChange,
  trailing,
  saveAction,
  wrapContentInCard = true,
  children,
  className,
}: PluginSettingsPageShellProps) {
  const showCategoryGrid = Boolean(categories && categories.length >= 2);
  const colCount = showCategoryGrid ? Math.min(4, categories!.length) : 2;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {(saveAction || trailing) && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {saveAction}
            {trailing}
          </div>
        )}
      </div>

      {showCategoryGrid ? (
        <div className={cn('grid grid-cols-2 gap-3', MD_GRID_COLS[colCount] ?? 'md:grid-cols-4')}>
          {categories!.map((category) => (
            <SettingsCategoryCard
              key={category.id}
              {...category}
              active={activeCategory === category.id}
              onSelect={() => onCategoryChange?.(category.id)}
            />
          ))}
        </div>
      ) : null}

      {wrapContentInCard ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <div className="p-4">{children}</div>
        </Card>
      ) : (
        children
      )}
    </div>
  );
}
