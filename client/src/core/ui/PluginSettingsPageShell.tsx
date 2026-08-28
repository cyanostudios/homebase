import { Check, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { type SettingsCategoryCardProps } from '@/core/ui/SettingsCategoryCard';
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
    <RoundIconLabelButton
      type="button"
      onClick={onClick}
      icon={Check}
      label={isSaving ? (savingLabel ?? t('common.saving')) : (label ?? t('common.save'))}
      variant="success"
      alwaysExpanded
      disabled={disabled || isSaving}
    />
  );
}

export type PluginSettingsCategory = Pick<
  SettingsCategoryCardProps,
  'id' | 'label' | 'description' | 'icon' | 'dotClassName'
>;

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
 * title row + category round buttons (shown when ≥1 category) + optional Save + Close in header (desktop), detail content card.
 * On phone, Close (+ Save when provided) replace the mobile bottom bar.
 */
export function PluginSettingsPageShell({
  title,
  subtitle: _subtitle,
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
  const showCategoryButtons = Boolean(categories && categories.length >= 1);

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
      <RoundIconLabelButton
        type="button"
        icon={X}
        label={t('common.close')}
        variant="secondary"
        alwaysExpanded
        onClick={onClose}
      />
    ) : null);

  const showHeaderActions = Boolean(saveAction || desktopTrailing);

  return (
    <div className={cn('space-y-4', className)}>
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{title}</h2>
          {showCategoryButtons
            ? categories!.map((category) => {
                const isActive = activeCategory === category.id;
                return (
                  <RoundIconLabelButton
                    key={category.id}
                    type="button"
                    icon={category.icon}
                    label={category.label}
                    variant={isActive ? 'primary' : 'soft'}
                    alwaysExpanded
                    aria-pressed={isActive}
                    onClick={() => onCategoryChange?.(category.id)}
                  />
                );
              })
            : null}
        </div>
        {showHeaderActions ? (
          <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
            {saveAction}
            {desktopTrailing}
          </div>
        ) : null}
      </div>

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
