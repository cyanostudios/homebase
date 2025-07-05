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
}

export function UniversalPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer
}: UniversalPanelProps) {
  return (
    <div 
      className={`fixed right-0 top-0 h-full w-[960px] bg-white shadow-lg border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Fixed Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <Button onClick={onClose} variant="danger" icon={X}>
        </Button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
          {footer}
        </div>
      )}
    </div>
  );
}
