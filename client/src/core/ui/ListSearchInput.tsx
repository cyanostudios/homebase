import { Search, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';

import { useRegisterMobileSearch } from './MobileActionsContext';

export interface ListSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/** Shared list-toolbar search field with optional clear (X). Registers for mobile bottom-bar search. */
export function ListSearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: ListSearchInputProps) {
  const { t } = useTranslation();
  const hasValue = value.trim().length > 0;

  useRegisterMobileSearch({ value, onChange, placeholder });

  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...LIST_SEARCH_FIELD_PROPS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-8 bg-background pl-9 text-xs',
          hasValue ? 'pr-8' : undefined,
          inputClassName,
        )}
      />
      {hasValue ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onChange('')}
          aria-label={t('common.clearSearch')}
          title={t('common.clearSearch')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
