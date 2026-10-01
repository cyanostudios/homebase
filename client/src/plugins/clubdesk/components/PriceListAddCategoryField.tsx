import { Plus } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { FORM_GHOST_INPUT_CLASS } from '@/core/ui/formFieldStyles';

export function PriceListAddCategoryField({
  value,
  onChange,
  onAdd,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('clubdesk.priceList.addCategoryPlaceholder')}
        className={FORM_GHOST_INPUT_CLASS}
        disabled={disabled}
        aria-label={t('clubdesk.priceList.categoriesCard')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
          }
        }}
      />
      <RoundIconLabelButton
        type="button"
        icon={Plus}
        label={t('clubdesk.priceList.addCategory')}
        variant="soft"
        size="xs"
        alwaysExpanded
        disabled={disabled || value.trim() === ''}
        onClick={onAdd}
      />
    </div>
  );
}
