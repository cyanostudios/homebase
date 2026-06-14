import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Rendered between title and close (X) button, e.g. prev/next navigation */
  headerRight?: React.ReactNode;
  /** Hide default close (X) button when custom close is rendered in headerRight. */
  showCloseButton?: boolean;
  mode?: 'view' | 'create' | 'edit';
  isMobile?: boolean;
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerRight,
  showCloseButton = true,
  mode: _mode = 'view',
  isMobile = false,
}: DetailPanelProps) {
  const hasTitle = typeof title === 'string' ? title.trim().length > 0 : Boolean(title);
  const hasSubtitle = Boolean(subtitle);
  const showTitleBlock = hasTitle || hasSubtitle;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousTitleRef = useRef<string>('');
  const previousOpenRef = useRef(false);

  // Handle ESC key to close panel
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Scroll to top when panel opens or when title changes (e.g. switching items)
  useEffect(() => {
    if (!isOpen) {
      previousOpenRef.current = false;
      return;
    }

    const titleKey = typeof title === 'string' ? title : '[node]';
    const justOpened = !previousOpenRef.current;
    const titleChanged = previousTitleRef.current !== titleKey;
    previousOpenRef.current = true;
    previousTitleRef.current = titleKey;

    if (!justOpened && !titleChanged) {
      return;
    }

    // Run after layout so the scroll container and content exist
    const raf = requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, title]);

  // Mobile: Render as Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="w-full sm:w-[90%] sm:max-w-lg p-0 flex flex-col min-h-0 h-full border-0 shadow-none bg-background"
        >
          <SheetHeader
            className={`px-6 pt-6 flex-shrink-0 flex flex-row items-start justify-between gap-4 ${showTitleBlock ? 'pb-4' : 'pb-2'}`}
          >
            {showTitleBlock ? (
              <div className="min-w-0 flex-1">
                {hasTitle ? <SheetTitle className="text-left">{title}</SheetTitle> : null}
                {subtitle && (
                  <div className="text-sm text-muted-foreground text-left mt-2">
                    {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
                  </div>
                )}
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerRight}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Scrollable Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto py-4 px-6 [&_.shadow-none]:border-none"
          >
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="flex flex-shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as div (existing behavior)
  if (!isOpen) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border-0 bg-background">
      {/* Fixed Header */}
      <div
        className={`flex flex-shrink-0 items-center justify-between px-6 ${showTitleBlock ? 'py-4' : 'py-2'}`}
      >
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          {showTitleBlock ? (
            <>
              {hasTitle ? (
                typeof title === 'string' ? (
                  <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
                    {title.length > 70 ? `${title.substring(0, 70)}...` : title}
                  </h2>
                ) : (
                  <div className="min-w-0 shrink-0 text-lg font-semibold tracking-tight">
                    {title}
                  </div>
                )
              ) : null}
              {subtitle && (
                <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {typeof subtitle === 'string' ? <p className="truncate">{subtitle}</p> : subtitle}
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {headerRight}
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 flex-shrink-0"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto py-4 px-6 [&_.shadow-none]:border-none"
      >
        {children}
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div className="flex flex-shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </div>
  );
}
