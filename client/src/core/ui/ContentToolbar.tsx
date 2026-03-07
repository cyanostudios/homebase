import { Search } from 'lucide-react';
import React from 'react';

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
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="relative w-full sm:w-80 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-10"
        />
      </div>
      {rightActions !== null && rightActions !== undefined ? (
        <div className="flex items-center gap-2 shrink-0">{rightActions}</div>
      ) : null}
    </div>
  );
}
