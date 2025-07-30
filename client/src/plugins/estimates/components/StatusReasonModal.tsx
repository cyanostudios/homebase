import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { ACCEPTANCE_REASONS, REJECTION_REASONS, StatusReason } from '../types/estimate';

interface StatusReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasons: string[]) => void;
  status: 'accepted' | 'rejected';
  estimateNumber: string;
}

export function StatusReasonModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  status, 
  estimateNumber 
}: StatusReasonModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  if (!isOpen) return null;

  const reasons = status === 'accepted' ? ACCEPTANCE_REASONS : REJECTION_REASONS;
  const title = status === 'accepted' ? 'Why was this estimate accepted?' : 'Why was this estimate rejected?';
  const subtitle = status === 'accepted' 
    ? 'Select all factors that contributed to the acceptance:' 
    : 'Select all factors that led to the rejection:';

  const handleReasonToggle = (reasonId: string) => {
    setSelectedReasons(prev => 
      prev.includes(reasonId) 
        ? prev.filter(id => id !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedReasons);
    setSelectedReasons([]); // Reset for next time
  };

  const handleCancel = () => {
    setSelectedReasons([]); // Reset selections
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">Estimate {estimateNumber}</p>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-50 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-gray-600 mb-4">{subtitle}</p>
          
          <div className="space-y-2">
            {reasons.map((reason) => (
              <label
                key={reason.id}
                className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(reason.id)}
                  onChange={() => handleReasonToggle(reason.id)}
                  className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-900">
                    {reason.label}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {/* FIX: Always show help message - removed condition */}
          <p className="text-xs text-gray-500 mt-4 italic">
            You can proceed without selecting any reasons, but it helps with statistics.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            className={status === 'accepted' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {status === 'accepted' ? 'Mark as Accepted' : 'Mark as Rejected'}
            {selectedReasons.length > 0 && ` (${selectedReasons.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}