import { LayoutGrid, Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ListViewMode } from '@/core/list/listViewMode';
import {
  LIST_LAYOUT_TOGGLE_DIVIDER_CLASS,
  LIST_LAYOUT_TOGGLE_SHELL_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

export type SettingsListViewModeToggleProps = {
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  /** Optional group label for screen readers (defaults to default list view). */
  groupLabel?: string;
};

const halfBaseClass = cn(
  'inline-flex h-11 w-11 items-center justify-center',
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  '[&_svg]:size-5',
);

/**
 * Cards | table split pill for plugin settings “Default list view”.
 * Same chrome as list-header `ListColumnLayoutToggle`, always visible (all viewports).
 */
export function SettingsListViewModeToggle({
  value,
  onChange,
  groupLabel,
}: SettingsListViewModeToggleProps) {
  const { t } = useTranslation();
  const cardsLabel = t('common.cardsView');
  const tableLabel = t('common.tableView');
  const isTable = value === 'table';

  return (
    <div
      role="group"
      aria-label={groupLabel ?? t('common.defaultListView')}
      className={LIST_LAYOUT_TOGGLE_SHELL_CLASS}
    >
      <button
        type="button"
        className={cn(
          halfBaseClass,
          'rounded-l-full hover:bg-primary/10',
          !isTable ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary',
        )}
        onClick={() => onChange('cards')}
        aria-label={cardsLabel}
        aria-pressed={!isTable}
        title={cardsLabel}
      >
        <LayoutGrid aria-hidden />
      </button>
      <span className={LIST_LAYOUT_TOGGLE_DIVIDER_CLASS} aria-hidden />
      <button
        type="button"
        className={cn(
          halfBaseClass,
          'rounded-r-full hover:bg-primary/10',
          isTable ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary',
        )}
        onClick={() => onChange('table')}
        aria-label={tableLabel}
        aria-pressed={isTable}
        title={tableLabel}
      >
        <Table2 aria-hidden />
      </button>
    </div>
  );
}
