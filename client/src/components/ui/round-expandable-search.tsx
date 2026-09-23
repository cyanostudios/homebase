import { Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';
import { BUTTON_COLOR_TRANSITION_CLASS } from '@/components/ui/button';

export type RoundExpandableSearchSize = 'sm' | 'xs';

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
  /**
   * `sm` matches primary list toolbar (`h-11`).
   * `xs` matches `RoundIconLabelButton` xs (companion toolbar).
   */
  size?: RoundExpandableSearchSize;
}

const sizeShellClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'h-11',
  xs: 'h-[2.0625rem]',
};

const sizeCollapsedWidthClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'w-11',
  xs: 'w-[2.0625rem]',
};

const sizeExpandedPadClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'px-3.5',
  xs: 'px-2.5',
};

const sizeCollapsedButtonClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'h-11 w-11',
  xs: 'h-[2.0625rem] w-[2.0625rem]',
};

const sizeIconClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'size-5',
  xs: 'size-[0.9375rem]',
};

const sizeInputClasses: Record<RoundExpandableSearchSize, string> = {
  sm: 'text-sm',
  xs: 'text-xs',
};

/** Round primary search control — icon-only until click, then widens to an input field. */
export function RoundExpandableSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
  expandedWidthClass = 'w-80',
  alwaysExpanded = false,
  size = 'sm',
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
        'inline-flex shrink-0 items-center overflow-hidden rounded-full',
        sizeShellClasses[size],
        'bg-primary text-primary-foreground',
        'transition-[width,padding] duration-200 ease-out',
        isExpanded
          ? cn(sizeExpandedPadClasses[size], expandedWidthClass)
          : sizeCollapsedWidthClasses[size],
        className,
      )}
    >
      {!isExpanded ? (
        <button
          type="button"
          className={cn(
            'flex items-center justify-center rounded-full',
            sizeCollapsedButtonClasses[size],
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            hasValue && 'relative',
          )}
          onClick={() => setExpanded(true)}
          aria-label={resolvedLabel}
          title={resolvedLabel}
        >
          <Search className={cn(sizeIconClasses[size], 'shrink-0')} aria-hidden />
          {hasValue ? (
            <span
              className={cn(
                'absolute rounded-full bg-primary-foreground',
                size === 'xs' ? 'right-1.5 top-1.5 h-1.5 w-1.5' : 'right-2 top-2 h-2 w-2',
              )}
            />
          ) : null}
        </button>
      ) : (
        <form
          className={cn('flex min-w-0 flex-1 items-center', size === 'xs' ? 'gap-1.5' : 'gap-2.5')}
          role="search"
          autoComplete="off"
          onSubmit={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full hover:bg-primary-foreground/15',
              size === 'xs' ? 'h-6 w-6' : 'h-7 w-7',
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
            <Search className={cn(sizeIconClasses[size], 'shrink-0 opacity-90')} aria-hidden />
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
              'min-w-0 flex-1 bg-transparent font-extrabold',
              sizeInputClasses[size],
              'placeholder:text-primary-foreground/60 focus:outline-none',
            )}
            aria-label={resolvedLabel}
          />
          {hasValue ? (
            <button
              type="button"
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full hover:bg-primary-foreground/15',
                size === 'xs' ? 'h-6 w-6' : 'h-7 w-7',
                BUTTON_COLOR_TRANSITION_CLASS,
              )}
              onClick={() => onChange('')}
              aria-label={t('common.clearSearch')}
              title={t('common.clearSearch')}
            >
              <X className={size === 'xs' ? 'size-3.5' : 'size-4'} />
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
