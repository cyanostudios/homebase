import { Filter, Search, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ContentToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  rightActions?: React.ReactNode;
}

export function ContentToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  rightActions,
}: ContentToolbarProps) {
  const { t } = useTranslation();
  const hasValue = searchValue.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className={`h-9 w-full pl-11 text-xs ${hasValue ? 'pr-9' : ''}`}
        />
        {hasValue ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => onSearchChange('')}
            aria-label={t('common.clearSearch')}
            title={t('common.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {rightActions ?? (
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        )}
      </div>
    </div>
  );
}
