import { Filter, Search } from 'lucide-react';
import React from 'react';

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
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-10"
        />
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
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
