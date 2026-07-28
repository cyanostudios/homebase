import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type Layout = 'block' | 'footer' | 'toolbar';

export function ListQuickAdd({
  viewMode,
  onCreate,
  className,
  label,
  titleLabel,
  titlePlaceholder,
  saveLabel,
  cancelLabel,
  errorContext = 'item',
  layout = 'block',
  open: openControlled,
  onOpenChange,
}: {
  viewMode: ViewMode;
  onCreate: (title: string) => Promise<void>;
  className?: string;
  label: string;
  titleLabel: string;
  titlePlaceholder: string;
  saveLabel: string;
  cancelLabel: string;
  errorContext?: string;
  /** `footer`: left-aligned trigger. `toolbar`: Select-style button; form for toolbar takeover. */
  layout?: Layout;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = openControlled ?? uncontrolledOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      if (openControlled === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [onOpenChange, openControlled],
  );

  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFooter = layout === 'footer';
  const isToolbar = layout === 'toolbar';

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    setTitle('');
    setIsOpen(false);
  }, [setIsOpen]);

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onCreate(trimmed);
      setTitle('');
      setIsOpen(false);
    } catch (error) {
      console.error(`Failed to quick-create ${errorContext}:`, error);
    } finally {
      setIsSaving(false);
    }
  }, [title, isSaving, onCreate, errorContext, setIsOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleSave();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={Plus}
      className={cn(
        'h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary',
        isFooter || isToolbar ? 'w-auto justify-start' : 'w-full justify-center',
      )}
      onClick={() => setIsOpen(true)}
      aria-label={label}
    >
      {label}
    </Button>
  );

  if (!isOpen) {
    if (isFooter || isToolbar) {
      return <div className={cn('flex justify-start', className)}>{triggerButton}</div>;
    }

    return (
      <div
        className={cn(
          viewMode === 'grid'
            ? 'rounded-xl border border-dashed border-border/60 bg-white px-2 py-1 dark:bg-slate-950'
            : 'border-t border-border/60 px-2 py-1',
          className,
        )}
      >
        {triggerButton}
      </div>
    );
  }

  const inputClassName = isToolbar
    ? 'h-9 min-w-0 flex-1 bg-background text-xs'
    : 'h-8 min-w-0 flex-1 bg-background text-xs';
  const actionButtonClass = isToolbar ? 'h-9 px-3 text-xs' : 'h-8 px-3 text-xs';

  const form = (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center',
        isFooter || isToolbar ? 'py-0' : viewMode === 'grid' ? 'p-4' : 'px-4 py-3',
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={titlePlaceholder}
        className={inputClassName}
        aria-label={titleLabel}
        disabled={isSaving}
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'border-none bg-green-600 text-white hover:bg-green-700 hover:text-white',
            actionButtonClass,
          )}
          disabled={!title.trim() || isSaving}
          onClick={() => void handleSave()}
        >
          {saveLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={actionButtonClass}
          disabled={isSaving}
          onClick={handleCancel}
        >
          {cancelLabel}
        </Button>
      </div>
    </div>
  );

  if (isFooter || isToolbar) {
    return (
      <div className={cn('min-w-0 w-full', isToolbar && 'sm:max-w-[50%]', className)}>{form}</div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <Card
        className={cn(
          'overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/20 shadow-none dark:bg-slate-900/40',
          className,
        )}
      >
        {form}
      </Card>
    );
  }

  return (
    <div className={cn('border-t border-border/60 bg-white dark:bg-slate-950', className)}>
      {form}
    </div>
  );
}
