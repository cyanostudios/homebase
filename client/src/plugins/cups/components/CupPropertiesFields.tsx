import React from 'react';
import { useTranslation } from 'react-i18next';

import { DETAIL_PROP_ROW_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { CupBooleanPropertySelect } from './CupBooleanPropertySelect';

export type CupPropertiesValues = {
  visible: boolean;
  sanctioned: boolean;
  featured: boolean;
};

type CupPropertiesFieldsProps = {
  values: CupPropertiesValues;
  onVisibleChange: (value: boolean) => void;
  onSanctionedChange: (value: boolean) => void;
  onFeaturedChange: (value: boolean) => void;
  /** View: property rows inside DetailSection. Form: same rows (section chrome lives in parent). */
  variant?: 'view' | 'form';
  className?: string;
};

export function CupPropertiesFields({
  values,
  onVisibleChange,
  onSanctionedChange,
  onFeaturedChange,
  variant = 'view',
  className,
}: CupPropertiesFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(variant === 'form' ? 'space-y-0' : undefined, className)}>
      <PropertyRow
        label={t('cups.propertyPublic')}
        value={values.visible}
        onChange={onVisibleChange}
      />
      <PropertyRow
        label={t('cups.propertySanctioned')}
        value={values.sanctioned}
        onChange={onSanctionedChange}
      />
      <PropertyRow
        label={t('cups.propertyFeatured')}
        value={values.featured}
        onChange={onFeaturedChange}
      />
    </div>
  );
}

function PropertyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={DETAIL_PROP_ROW_CLASS}>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <CupBooleanPropertySelect value={value} onChange={onChange} hideInlineLabel />
    </div>
  );
}
