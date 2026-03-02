import { Check, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

const BTN_XS = 'sm' as const;

interface SettingsFooterProps {
  category: 'profile' | 'preferences' | 'activity-log' | 'security';
  onClose: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
}

/** 3.X-style settings panel footer: Close only for activity-log/security, Close + Save for profile/preferences */
export function SettingsFooter({
  category,
  onClose,
  onSave,
  isSaving = false,
}: SettingsFooterProps) {
  const isEditable = category === 'profile' || category === 'preferences';

  if (!isEditable) {
    return (
      <div className="flex justify-end w-full">
        <Button type="button" onClick={onClose} variant="secondary" size={BTN_XS}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-end space-x-2">
      <Button type="button" onClick={onClose} variant="secondary" size={BTN_XS} disabled={isSaving}>
        <X className="h-4 w-4" />
        Close
      </Button>
      <Button
        type="button"
        onClick={() => onSave?.()}
        variant="primary"
        size={BTN_XS}
        disabled={isSaving}
        className="bg-green-600 hover:bg-green-700 text-white border-none"
      >
        <Check className="h-4 w-4" />
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
