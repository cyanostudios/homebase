import React from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface UniversalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | React.ReactNode; // Accept JSX elements
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: {
    mobile?: string;
    sm?: string;
    md?: string;
    lg?: string;
  };
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
}

export function UniversalPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = {
    mobile: 'w-full',
    sm: 'sm:w-[90%]',
    md: 'md:w-[600px]',
    lg: 'lg:w-[800px]',
  },
  showBackdrop = true,
  closeOnBackdropClick = true,
}: UniversalPanelProps) {
  // Handle Sheet's onOpenChange to maintain backward compatibility
  const handleOpenChange = (open: boolean) => {
    if (!open && isOpen) {
      onClose();
    }
  };

  // Handle backdrop click - prevent closing if closeOnBackdropClick is false
  const handleInteractOutside = (event: Event) => {
    if (!closeOnBackdropClick || !showBackdrop) {
      event.preventDefault();
    }
  };

  // Prevent ESC key from closing if closeOnBackdropClick is false
  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (!closeOnBackdropClick) {
      event.preventDefault();
    }
  };

  return (
    <>
      {/* Hide overlay if showBackdrop is false */}
      {!showBackdrop && isOpen && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            [data-radix-dialog-overlay] {
              display: none !important;
            }
          `,
          }}
        />
      )}
      <Sheet open={isOpen} onOpenChange={handleOpenChange} modal={showBackdrop}>
        <SheetContent
          side="right"
          onInteractOutside={handleInteractOutside}
          onEscapeKeyDown={handleEscapeKeyDown}
          className={cn(
            'flex flex-col p-0 h-full',
            // Override default Sheet width from sheetVariants (w-3/4 sm:max-w-sm)
            // Add !important modifier to ensure custom widths override defaults
            width.mobile ? `!${width.mobile}` : '!w-full',
            width.sm ? `sm:!${width.sm.replace(/^sm:/, '')}` : 'sm:!w-[90%]',
            width.md ? `md:!${width.md.replace(/^md:/, '')}` : 'md:!w-[600px]',
            width.lg ? `lg:!${width.lg.replace(/^lg:/, '')}` : 'lg:!w-[800px]',
            // Override default max-width from sheetVariants
            '!max-w-none sm:!max-w-none',
          )}
        >
          {/* Fixed Header */}
          <SheetHeader className="px-4 sm:px-6 py-6 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4 space-y-3">
                <SheetTitle className="text-left">{title}</SheetTitle>
                {subtitle && (
                  <SheetDescription asChild className="text-left">
                    {typeof subtitle === 'string' ? <p>{subtitle}</p> : <div>{subtitle}</div>}
                  </SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 [&_.shadow-none]:border-none [&_.shadow-sm]:shadow-none [&_.shadow-sm]:border-none">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <SheetFooter className="px-4 sm:px-6 py-4 border-t border-border flex-shrink-0 bg-background sm:flex-row sm:justify-end gap-3">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
