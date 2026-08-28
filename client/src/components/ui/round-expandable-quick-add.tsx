import { Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';

export interface RoundExpandableQuickAddProps {
  onCreate: (title: string) => Promise<void>;
  label: string;
  placeholder: string;
  className?: string;
  /** Tailwind width class when expanded (default w-80). */
  expandedWidthClass?: string;
  /** Start expanded (input visible). Only initial state — outside click / Escape collapse to icon. */
  defaultExpanded?: boolean;
  /**
   * Visual tone. `soft` = light blue (less prominent), e.g. when quick context is open.
   * Default `primary` = solid blue.
   */
  variant?: 'primary' | 'soft';
}

/** Round primary quick-add — icon-only until click, then widens to a title input (same shell as RoundExpandableSearch). */
export function RoundExpandableQuickAdd({
  onCreate,
  label,
  placeholder,
  className,
  expandedWidthClass = 'w-80',
  defaultExpanded = false,
  variant = 'primary',
}: RoundExpandableQuickAddProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [blockAutofill, setBlockAutofill] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasValue = title.trim().length > 0;
  const isSoft = variant === 'soft';

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
      // Collapse to icon on any outside click (filter, list row, etc.).
      // defaultExpanded only controls the initial open state.
      setExpanded(false);
      setTitle('');
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTitle('');
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

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onCreate(trimmed);
      setTitle('');
      setExpanded(false);
    } catch (error) {
      console.error('Failed to quick-create:', error);
    } finally {
      setIsSaving(false);
    }
  }, [title, isSaving, onCreate]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full',
        'transition-[width,padding,background-color,color] duration-200 ease-out',
        isSoft ? 'bg-primary/10 text-primary' : 'bg-primary text-primary-foreground',
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
          )}
          onClick={() => setExpanded(true)}
          aria-label={label}
          title={label}
        >
          <Plus className="size-5 shrink-0" aria-hidden />
        </button>
      ) : (
        <form
          className="flex min-w-0 flex-1 items-center gap-2.5"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <button
            type="button"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
              isSoft ? 'hover:bg-primary/15' : 'hover:bg-primary-foreground/15',
            )}
            onClick={() => {
              setExpanded(false);
              setTitle('');
            }}
            aria-label={t('common.close')}
            title={t('common.close')}
            disabled={isSaving}
          >
            <Plus className="size-5 shrink-0 opacity-90" aria-hidden />
          </button>
          <input
            ref={inputRef}
            {...LIST_SEARCH_FIELD_PROPS}
            name="homebase-quick-add"
            inputMode="text"
            role="textbox"
            value={title}
            readOnly={blockAutofill || isSaving}
            disabled={isSaving}
            onFocus={() => setBlockAutofill(false)}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={placeholder}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-sm font-extrabold focus:outline-none',
              isSoft ? 'placeholder:text-primary/50' : 'placeholder:text-primary-foreground/60',
            )}
            aria-label={label}
          />
          {hasValue ? (
            <button
              type="button"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                isSoft ? 'hover:bg-primary/15' : 'hover:bg-primary-foreground/15',
              )}
              onClick={() => setTitle('')}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              disabled={isSaving}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
