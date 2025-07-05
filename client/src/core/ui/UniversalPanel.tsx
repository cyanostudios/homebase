import React from 'react';
import { X } from 'lucide-react';

interface UniversalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function UniversalPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  width = '672px',
  children,
  footer
}: UniversalPanelProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 z-50 transform transition-transform duration-300"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
} 