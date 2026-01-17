import { X } from 'lucide-react';
import React, { useEffect } from 'react';

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

  return (
    <div className="w-full lg:w-[600px] flex-shrink-0 flex h-full flex-col bg-background border-t border-border lg:border-t-0 lg:border-l">
      {isOpen ? (
        <>
          {/* Fixed Header */}
          <div className="flex items-start justify-between px-4 sm:px-6 py-6 border-b border-border flex-shrink-0 bg-background">
            <div className="flex-1 mr-4 space-y-3 min-w-0">
              <h2 className="text-xl font-semibold leading-none tracking-tight text-left">
                {title}
              </h2>
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 [&_.shadow-none]:border-none [&_.shadow-sm]:shadow-none [&_.shadow-sm]:border-none">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="px-4 sm:px-6 py-4 border-t border-border flex-shrink-0 bg-background flex flex-col sm:flex-row sm:justify-end gap-3">
              {footer}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Select an item to view details</p>
        </div>
      )}
    </div>
  );
}
