import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/core/ui/Button';

interface UniversalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
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
    lg: 'lg:w-[800px]'
  },
  showBackdrop = true,
  closeOnBackdropClick = true
}: UniversalPanelProps) {
  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      {isOpen && showBackdrop && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeOnBackdropClick ? onClose : undefined}
        />
      )}
      
      {/* Panel */}
      <div 
        className={`fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out flex flex-col
          ${width.mobile} ${width.sm} ${width.md} ${width.lg}
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 mr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
          </div>
          <Button onClick={onClose} variant="danger" icon={X} size="sm">
          </Button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              {footer}
            </div>
          </div>
        )}
      </div>
    </>
  );
}