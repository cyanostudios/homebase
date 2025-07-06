import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'warning'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-6 h-6 ${
              variant === 'danger' ? 'text-red-500' : 'text-yellow-500'
            }`} />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={onCancel}
          />
        </div>
        
        <div className="p-6">
          <p className="text-gray-700">{message}</p>
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
