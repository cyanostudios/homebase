import React from 'react';

import { cn } from '@/lib/utils';

export interface ListToolbarProps {
  /** When > 0, idle controls are replaced by bulkActions (unless quick-add is expanded). */
  selectedCount: number;
  /** Show select-all control (typically when the list has visible rows). */
  showSelectAll?: boolean;
  /** Select-all button (idle only). */
  selectAll?: React.ReactNode;
  /** Idle-only controls beside select-all (e.g. Quick task / Quick note). */
  leadingActions?: React.ReactNode;
  search: React.ReactNode;
  /** Sort + column toggles (idle only). */
  trailing: React.ReactNode;
  /** Clear, count badge, and plugin bulk actions (selection only). */
  bulkActions?: React.ReactNode;
  /**
   * When true, the toolbar row is replaced by `quickAddExpanded` content
   * (same takeover pattern as bulk selection). Takes priority over selection.
   */
  quickAddOpen?: boolean;
  quickAddExpanded?: React.ReactNode;
  className?: string;
}

/**
 * Unified list toolbar:
 * - idle: select-all + optional leading actions | search + sort/columns
 * - quick-add open: expanded quick-add form takes the whole row
 * - selection: bulk actions take the whole row
 */
export function ListToolbar({
  selectedCount,
  showSelectAll = false,
  selectAll,
  leadingActions,
  search,
  trailing,
  bulkActions,
  quickAddOpen = false,
  quickAddExpanded,
  className,
}: ListToolbarProps) {
  const isSelecting = selectedCount > 0 && !quickAddOpen;

  return (
    <div
      className={cn(
        'flex min-h-[3.75rem] flex-shrink-0 flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950',
        className,
      )}
    >
      {quickAddOpen && quickAddExpanded ? (
        <div className="w-full min-w-0">{quickAddExpanded}</div>
      ) : isSelecting ? (
        <div className="flex min-h-9 w-full flex-wrap items-center gap-2">{bulkActions}</div>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-2 md:flex-nowrap">
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {showSelectAll && selectAll ? selectAll : null}
            {leadingActions}
          </div>
          <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <div className="min-w-0 w-full max-w-sm sm:w-56 md:w-64">{search}</div>
            <div className="flex shrink-0 items-center gap-1">{trailing}</div>
          </div>
        </div>
      )}
    </div>
  );
}
