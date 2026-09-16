import { Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';
import { BUTTON_COLOR_TRANSITION_CLASS } from '@/components/ui/button';

export interface RoundExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Collapsed button aria-label / title */
  label?: string;
  className?: string;
  /** Tailwind width class when expanded (default w-80). */
  expandedWidthClass?: string;
  /** Keep the search field open (no icon-only collapse). */
  alwaysExpanded?: boolean;
}

/** Round primary search control — icon-only until click, then widens to an input field. */
export function RoundExpandableSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
  expandedWidthClass = 'w-80',
  alwaysExpanded = false,
}: RoundExpandableSearchProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [blockAutofill, setBlockAutofill] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedLabel = label ?? t('common.search');
  const hasValue = value.trim().length > 0;
  const hasValueRef = useRef(hasValue);
  const isExpanded = alwaysExpanded || expanded;

  useEffect(() => {
    hasValueRef.current = hasValue;
  }, [hasValue]);

  // "Always open if it has value".
  // If search text exists when the component remounts (e.g. opening full view/edit),
  // keep it expanded.
  useEffect(() => {
    if (hasValue) {
      setExpanded(true);
    }
  }, [hasValue]);

  useEffect(() => {
    if (alwaysExpanded) {
      setExpanded(true);
    }
  }, [alwaysExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      setBlockAutofill(true);
      return;
    }
    if (alwaysExpanded) {
      // Don't steal focus on mount when permanently open.
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [isExpanded, alwaysExpanded]);

  useEffect(() => {
    if (!isExpanded || alwaysExpanded) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      // Keep expanded when the user already entered a search value.
      // This avoids accidental collapse when clicking other UI elements.
      if (hasValueRef.current) {
        return;
      }
      setExpanded(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (hasValueRef.current) {
          onChange('');
        }
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, alwaysExpanded, onChange]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full',
        'bg-primary text-primary-foreground',
        'transition-[width,padding] duration-200 ease-out',
        isExpanded ? cn('px-3.5', expandedWidthClass) : 'w-11',
        className,
      )}
    >
      {!isExpanded ? (
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
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-primary-foreground/15',
              BUTTON_COLOR_TRANSITION_CLASS,
            )}
            onClick={() => {
              onChange('');
              if (!alwaysExpanded) {
                setExpanded(false);
              }
            }}
            aria-label={alwaysExpanded ? resolvedLabel : t('common.close')}
            title={alwaysExpanded ? resolvedLabel : t('common.close')}
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
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-primary-foreground/15',
                BUTTON_COLOR_TRANSITION_CLASS,
              )}
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
