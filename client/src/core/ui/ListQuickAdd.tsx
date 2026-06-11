import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DETAIL_QUICK_ACTION_ROW_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    setTitle('');
    setIsOpen(false);
  }, []);

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
  }, [title, isSaving, onCreate, errorContext]);

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

  if (!isOpen) {
    return (
      <div
        className={cn(
          viewMode === 'grid'
            ? 'rounded-xl border border-dashed border-border/60 bg-white px-2 py-1 dark:bg-slate-950'
            : 'border-t border-border/60 px-2 py-1',
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={(props) => (
            <Plus {...props} className={cn(props.className, 'text-blue-600 dark:text-blue-400')} />
          )}
          className={cn(
            DETAIL_QUICK_ACTION_ROW_CLASS,
            'w-full justify-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
          )}
          onClick={() => setIsOpen(true)}
          aria-label={label}
        >
          {label}
        </Button>
      </div>
    );
  }

  const form = (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center',
        viewMode === 'grid' ? 'p-4' : 'px-4 py-3',
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
        className="h-8 flex-1 bg-background text-xs"
        aria-label={titleLabel}
        disabled={isSaving}
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700 hover:text-white"
          disabled={!title.trim() || isSaving}
          onClick={() => void handleSave()}
        >
          {saveLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={isSaving}
          onClick={handleCancel}
        >
          {cancelLabel}
        </Button>
      </div>
    </div>
  );

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
