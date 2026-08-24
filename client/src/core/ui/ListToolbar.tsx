import React from 'react';

import { useIsMobile } from '@/hooks/useMediaQuery';
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
  /** Idle-only control immediately before the search field. */
  beforeSearch?: React.ReactNode;
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
 * - phone idle: entire card hidden (search stays mounted for bottom-bar registration)
 * - pad/desktop idle: full toolbar with inline search
 * - quick-add open: expanded quick-add form takes the whole row
 * - selection: bulk actions take the whole row (pad/desktop; suppressed on phone)
 */
export function ListToolbar({
  selectedCount,
  showSelectAll = false,
  selectAll,
  leadingActions,
  beforeSearch,
  search,
  trailing,
  bulkActions,
  quickAddOpen = false,
  quickAddExpanded,
  className,
}: ListToolbarProps) {
  const isMobile = useIsMobile();
  const effectiveSelectedCount = isMobile ? 0 : selectedCount;
  const isSelecting = effectiveSelectedCount > 0 && !quickAddOpen;

  // Mobile: no sort/select/search card — keep search mounted for bottom-bar registration only.
  if (isMobile && !quickAddOpen) {
    return (
      <div className="hidden" aria-hidden>
        {search}
      </div>
    );
  }

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
        <div className="flex min-h-9 w-full flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center [&>button]:w-full [&>button]:justify-start md:[&>button]:w-auto md:[&>button]:justify-center [&>span]:w-full md:[&>span]:w-auto">
          {bulkActions}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2 md:flex-row md:flex-nowrap md:items-center">
          <div className="order-3 flex shrink-0 flex-wrap items-center gap-1 md:order-1">
            {showSelectAll && selectAll ? selectAll : null}
            {leadingActions}
          </div>
          <div className="order-1 flex w-full min-w-0 flex-col gap-2 md:order-2 md:ml-auto md:flex-1 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-2 lg:flex-nowrap">
            {beforeSearch ? <div className="flex shrink-0 items-center">{beforeSearch}</div> : null}
            <div className="min-w-0 w-full md:max-w-sm md:w-56 lg:w-64">{search}</div>
            <div className="order-2 flex w-full min-w-0 shrink-0 items-center gap-1 md:w-auto [&>div]:flex [&>div]:min-w-0 [&>div]:flex-1 [&>div]:items-center md:[&>div]:flex-none [&_button[role=combobox]]:w-full md:[&_button[role=combobox]]:w-[140px]">
              {trailing}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
