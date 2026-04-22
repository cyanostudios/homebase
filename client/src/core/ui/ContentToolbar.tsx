import { Search } from 'lucide-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { ErrorLogButton } from '@/core/errorLog/ErrorLogButton';
import { useErrorLog } from '@/core/errorLog/ErrorLogContext';
import { cn } from '@/lib/utils';

interface ContentToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** When false, no left search icon (use placeholder text instead). Default true. */
  showSearchIcon?: boolean;
  /** Renders before the search input (e.g. scope dropdown); input gets merged left border radius. */
  searchLeading?: React.ReactNode;
  /** Same row as search, after the input (e.g. list filter). */
  searchRowTrailing?: React.ReactNode;
  /** Shown on the same row as the search field, after searchRowTrailing (e.g. selection summary). */
  afterSearch?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export function ContentToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearchIcon = true,
  searchLeading,
  searchRowTrailing,
  afterSearch,
  rightActions,
}: ContentToolbarProps) {
  const { count } = useErrorLog();

  const hasRightColumn = (rightActions !== null && rightActions !== undefined) || count > 0;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full min-w-0">
        <div
          className={cn(
            'flex min-w-0 w-full flex-row flex-nowrap items-center gap-2 overflow-x-auto sm:overflow-visible sm:gap-3',
            searchLeading ? 'min-w-0 flex-1 sm:min-w-0' : 'sm:w-auto sm:shrink-0',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 w-full max-w-full',
              searchLeading ? 'min-w-0 flex-1' : 'shrink-0 sm:w-80 sm:min-w-0',
              searchLeading && 'items-stretch gap-0',
            )}
          >
            {searchLeading ? (
              <div className="flex w-[9.5rem] max-w-[9.5rem] shrink-0 flex-none overflow-hidden [&_select]:box-border [&_select]:h-10 [&_select]:min-w-0 [&_select]:w-full [&_select]:max-w-full [&_select]:rounded-r-none [&_select]:border-r-0 [&_button]:box-border [&_button]:h-10 [&_button]:min-w-0 [&_button]:w-full [&_button]:max-w-full [&_button]:rounded-r-none [&_button]:border-r-0">
                {searchLeading}
              </div>
            ) : null}
            <div className="relative min-w-0 flex-1">
              {showSearchIcon ? (
                <Search className="absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
              ) : null}
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                className={cn(
                  'w-full',
                  showSearchIcon ? 'pl-10' : 'pl-3',
                  searchLeading && 'rounded-l-none',
                )}
              />
            </div>
          </div>
          {searchRowTrailing ? (
            <div className="flex shrink-0 items-center">{searchRowTrailing}</div>
          ) : null}
          {afterSearch ? (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{afterSearch}</div>
          ) : null}
        </div>
        {hasRightColumn ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
            {rightActions !== null && rightActions !== undefined ? (
              <div className="flex flex-wrap items-center justify-end gap-2">{rightActions}</div>
            ) : null}
            {count > 0 ? (
              <div className="shrink-0">
                <ErrorLogButton />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
