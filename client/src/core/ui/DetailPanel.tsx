import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mode?: 'view' | 'create' | 'edit';
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  mode: _mode = 'view',
}: DetailPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousTitleRef = useRef<string>('');

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

  // Scroll to top when title changes or panel opens (when switching items, e.g., contact to note via @mention)
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current || !title) {
      return;
    }

    // Scroll if title changed (including when switching between different items)
    if (previousTitleRef.current !== title) {
      scrollContainerRef.current.scrollTop = 0;
      previousTitleRef.current = title;
    }
  }, [title, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-full h-full flex-shrink-0 flex flex-col border-2 border-primary/30 rounded-md animate-border-pulse">
      {/* Fixed Header */}
      <div className="flex items-start justify-between py-6 px-6 border-b border-border flex-shrink-0">
        <div className="flex-1 mr-4 space-y-3 min-w-0">
          <h2 className="text-xl font-semibold leading-none tracking-tight text-left">{title}</h2>
          {subtitle && (
            <div className="text-sm text-muted-foreground text-left">
              {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 flex-shrink-0"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-4 px-6 [&_.shadow-none]:border-none [&_.shadow-sm]:shadow-none [&_.shadow-sm]:border-none"
      >
        {children}
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div className="py-4 px-6 border-t border-border flex-shrink-0 flex flex-col sm:flex-row sm:justify-end gap-3">
          {footer}
        </div>
      )}
    </div>
  );
}
