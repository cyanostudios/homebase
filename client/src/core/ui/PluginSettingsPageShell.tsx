import { Check, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_SUBTITLE_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
} from '@/core/ui/pluginPageStyles';
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
  /**
   * Close handler — desktop Close in header; phone Close in the bottom bar
   * (replaces Search/Add/Settings while settings is open).
   */
  onClose?: () => void;
  /** Optional Save for phone bottom bar (when dirty). Desktop still uses saveAction. */
  onSave?: () => void;
  isSaving?: boolean;
  /** Close (and any other non-save trailing controls) — desktop only when onClose is set. */
  trailing?: React.ReactNode;
  /** Save control shown in the header when dirty (Core Settings pattern). Desktop only when onClose is set. */
  saveAction?: React.ReactNode;
  /** When false, children are rendered without the DETAIL_VIEW card wrapper. */
  wrapContentInCard?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Full-page plugin settings shell matching Core Settings layout:
 * title + subtitle, optional Save + Close in header (desktop), category cards, detail content card.
 * On phone, Close (+ Save when provided) replace the mobile bottom bar.
 */
export function PluginSettingsPageShell({
  title,
  subtitle,
  categories,
  activeCategory,
  onCategoryChange,
  onClose,
  onSave,
  isSaving = false,
  trailing,
  saveAction,
  wrapContentInCard = true,
  children,
  className,
}: PluginSettingsPageShellProps) {
  const { t } = useTranslation();
  const showCategoryGrid = Boolean(categories && categories.length >= 2);
  const colCount = Math.min(Math.max(categories?.length ?? 1, 1), 4);

  useMobileBarOverride(
    onClose
      ? {
          onClose,
          onSave,
          isSaving,
        }
      : null,
  );

  const desktopTrailing =
    trailing ??
    (onClose ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={X}
        className="h-9 px-3 text-xs"
        onClick={onClose}
      >
        {t('common.close')}
      </Button>
    ) : null);

  const showHeaderActions = Boolean(saveAction || desktopTrailing);

  return (
    <div className={cn('space-y-4', className)}>
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className="min-w-0 space-y-1">
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{title}</h2>
          {subtitle ? <p className={PLUGIN_PAGE_SUBTITLE_CLASS}>{subtitle}</p> : null}
        </div>
        {showHeaderActions ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            {saveAction}
            {desktopTrailing}
          </div>
        ) : null}
      </div>

      {showCategoryGrid ? (
        <div className={cn('grid grid-cols-1 gap-3', MD_GRID_COLS[colCount] ?? 'md:grid-cols-4')}>
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
