import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ContentSurface, MAIN_CONTENT_SHELL_CLASS } from '@/core/ui/ContentSurface';
import {
  DETAIL_PANEL_BODY_CLASS,
  DETAIL_PANEL_HEADER_ROW_CLASS,
  DETAIL_PANEL_INSET_CLASS,
  DETAIL_PANEL_SHELL_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

/** Keep in sync with `duration-200` on the panel shell. */
export const COMPANION_PANEL_ANIMATION_MS = 200;

export interface CompanionPanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * When false, Escape does not close this panel (e.g. while a detail panel is open
   * so Escape only dismisses the primary detail surface).
   */
  closeOnEscape?: boolean;
}

/**
 * Desktop-only secondary plugin surface (split inside main, left of AppRightSidebar).
 * Phone/pad callers should not mount this.
 * Stays mounted through the close transition so slide-out can finish.
 */
export function CompanionPanel({
  isOpen,
  title,
  onClose,
  children,
  className,
  closeOnEscape = true,
}: CompanionPanelProps) {
  const { t } = useTranslation();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animOpen, setAnimOpen] = useState(false);
  const cachedTitleRef = useRef(title);
  const cachedChildrenRef = useRef(children);

  if (isOpen) {
    cachedTitleRef.current = title;
    cachedChildrenRef.current = children;
  }

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => {
        setAnimOpen(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    setAnimOpen(false);
    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, COMPANION_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  if (!shouldRender) {
    return null;
  }

  const displayTitle = isOpen ? title : cachedTitleRef.current;
  const displayChildren = isOpen ? children : cachedChildrenRef.current;

  return (
    <div
      className={cn(
        'flex min-h-0 w-[40%] min-w-[320px] max-w-[560px] flex-none',
        'transition-[transform,opacity] duration-200 ease-out',
        animOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0',
        className,
      )}
      role="complementary"
      aria-label={displayTitle}
      aria-hidden={!animOpen}
    >
      <ContentSurface flush className="flex min-h-0 w-full flex-1 flex-col">
        <div
          className={cn(
            MAIN_CONTENT_SHELL_CLASS,
            DETAIL_PANEL_SHELL_CLASS,
            'flex min-h-0 flex-1 flex-col',
          )}
        >
          <div className={cn(DETAIL_PANEL_INSET_CLASS, 'flex min-h-0 flex-1 flex-col')}>
            <div className={DETAIL_PANEL_HEADER_ROW_CLASS}>
              <h2 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 truncate')}>{displayTitle}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={cn(DETAIL_PANEL_BODY_CLASS, 'min-h-0 flex-1 overflow-y-auto')}>
              {displayChildren}
            </div>
          </div>
        </div>
      </ContentSurface>
    </div>
  );
}
