import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { MAIN_CONTENT_SHELL_CLASS } from '@/core/ui/ContentSurface';
import {
  DETAIL_PANEL_BODY_DESKTOP_CLASS,
  DETAIL_PANEL_HEADER_DESKTOP_CLASS,
  MOBILE_FLOATING_CHROME_CLASS,
  PLUGIN_PAGE_SUBTITLE_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

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
  /**
   * When this changes (plugin/mode/item), scroll content to top.
   * Prefer over title — view mode often has an empty panel title.
   */
  contentKey?: string;
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
  contentKey,
}: DetailPanelProps) {
  const hasTitle = typeof title === 'string' ? title.trim().length > 0 : Boolean(title);
  const hasSubtitle = Boolean(subtitle);
  const showTitleBlock = hasTitle || hasSubtitle;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousContentKeyRef = useRef<string>('');
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

  // Always land at top when opening detail or switching item/mode
  useEffect(() => {
    if (!isOpen) {
      previousOpenRef.current = false;
      previousContentKeyRef.current = '';
      return;
    }

    const key = contentKey ?? (typeof title === 'string' ? title : '[node]');
    const justOpened = !previousOpenRef.current;
    const keyChanged = previousContentKeyRef.current !== key;
    previousOpenRef.current = true;
    previousContentKeyRef.current = key;

    if (!justOpened && !keyChanged) {
      return;
    }

    const scrollToTop = () => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = 0;
        el.scrollTo({ top: 0, behavior: 'auto' });
      }
    };

    scrollToTop();
    const raf1 = requestAnimationFrame(() => {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
    });
    const timeoutId = window.setTimeout(scrollToTop, 50);
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, contentKey, title]);

  if (!isOpen) {
    return null;
  }

  const hasBottomActions = isMobile && (Boolean(headerRight) || showCloseButton);

  const titleNode = hasTitle ? (
    typeof title === 'string' ? (
      <h2 className={cn(PLUGIN_PAGE_TITLE_CLASS, isMobile && 'text-lg')}>
        {title.length > 70 ? `${title.substring(0, 70)}...` : title}
      </h2>
    ) : (
      <div className={cn(PLUGIN_PAGE_TITLE_CLASS, isMobile && 'text-lg')}>{title}</div>
    )
  ) : null;

  const subtitleNode = subtitle ? (
    <div className={cn(PLUGIN_PAGE_SUBTITLE_CLASS, 'min-w-0')}>
      {typeof subtitle === 'string' ? <p className="truncate">{subtitle}</p> : subtitle}
    </div>
  ) : null;

  return (
    <div className={cn(MAIN_CONTENT_SHELL_CLASS, isMobile && 'relative min-h-0 flex-1')}>
      {/* Fixed Header — on phone, primary actions float over content at the bottom */}
      {(showTitleBlock || (!isMobile && (headerRight || showCloseButton))) && (
        <div
          className={cn(
            isMobile
              ? cn(
                  'flex flex-shrink-0 items-start justify-between gap-4',
                  showTitleBlock ? 'px-2 pb-2 pt-2 sm:px-3' : 'px-2 pb-0 pt-2 sm:px-3',
                )
              : showTitleBlock
                ? DETAIL_PANEL_HEADER_DESKTOP_CLASS
                : 'flex flex-shrink-0 items-start justify-between gap-4 px-6 py-2',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
            {showTitleBlock ? (
              <>
                {titleNode}
                {subtitleNode}
              </>
            ) : null}
          </div>
          {!isMobile ? (
            <div className="flex shrink-0 items-center gap-1">
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
          ) : null}
        </div>
      )}

      {/* Scrollable Content — fills panel; phone bottom actions float over it */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden [&_.shadow-none]:border-none',
          isMobile
            ? cn(
                'px-2 sm:px-3',
                hasBottomActions ? 'pb-20' : 'pb-4',
                showTitleBlock ? 'pt-3' : 'pt-1',
              )
            : DETAIL_PANEL_BODY_DESKTOP_CLASS,
        )}
      >
        {children}
        {footer && isMobile ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </div>

      {/* Desktop/pad: optional plugin footer in flow */}
      {footer && !isMobile ? (
        <div className="flex flex-shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      ) : null}

      {/* Phone: Edit/Close fixed to viewport (portaled) — always visible while scrolling */}
      {hasBottomActions && typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
              <div
                className={cn(
                  'pointer-events-auto flex w-full items-center gap-2 px-2 py-2',
                  MOBILE_FLOATING_CHROME_CLASS,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 [&_button]:shadow-sm">
                  {headerRight}
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 shrink-0 bg-background/80 shadow-sm"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
