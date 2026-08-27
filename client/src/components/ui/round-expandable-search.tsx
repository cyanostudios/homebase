import { Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';

export interface RoundExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Collapsed button aria-label / title */
  label?: string;
  className?: string;
  /** Tailwind width class when expanded (default w-80). */
  expandedWidthClass?: string;
}

/** Round primary search control — icon-only until click, then widens to an input field. */
export function RoundExpandableSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
  expandedWidthClass = 'w-80',
}: RoundExpandableSearchProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [blockAutofill, setBlockAutofill] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedLabel = label ?? t('common.search');
  const hasValue = value.trim().length > 0;

  useEffect(() => {
    if (!expanded) {
      setBlockAutofill(true);
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [expanded]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setExpanded(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full',
        'bg-primary text-primary-foreground',
        'transition-[width,padding] duration-200 ease-out',
        expanded ? cn('px-3.5', expandedWidthClass) : 'w-11',
        className,
      )}
    >
      {!expanded ? (
        <button
          type="button"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            hasValue && 'relative',
          )}
          onClick={() => setExpanded(true)}
          aria-label={resolvedLabel}
          title={resolvedLabel}
        >
          <Search className="size-5 shrink-0" aria-hidden />
          {hasValue ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-foreground" />
          ) : null}
        </button>
      ) : (
        <form
          className="flex min-w-0 flex-1 items-center gap-2.5"
          role="search"
          autoComplete="off"
          onSubmit={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
            onClick={() => setExpanded(false)}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <Search className="size-5 shrink-0 opacity-90" aria-hidden />
          </button>
          <input
            ref={inputRef}
            {...LIST_SEARCH_FIELD_PROPS}
            value={value}
            readOnly={blockAutofill}
            onFocus={() => setBlockAutofill(false)}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-sm font-extrabold',
              'placeholder:text-primary-foreground/60 focus:outline-none',
            )}
            aria-label={resolvedLabel}
          />
          {hasValue ? (
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
              onClick={() => onChange('')}
              aria-label={t('common.clearSearch')}
              title={t('common.clearSearch')}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
