import React from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Right-aligned “show in public app” control for Clubdesk Info section headers. */
export function ClubdeskPublicVisibleSwitch({
  id,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor={id}
        className="cursor-pointer text-xs font-medium text-muted-foreground whitespace-nowrap"
      >
        {t('clubdesk.siteContent.infoVisible')}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
