import { X } from 'lucide-react';
import React, { useEffect } from 'react';
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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex min-h-0 w-[40%] min-w-[320px] max-w-[560px] flex-none animate-in fade-in slide-in-from-right-4 duration-200',
        className,
      )}
      role="complementary"
      aria-label={title}
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
              <h2 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 truncate')}>{title}</h2>
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
              {children}
            </div>
          </div>
        </div>
      </ContentSurface>
    </div>
  );
}
