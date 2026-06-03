import { SlidersHorizontal } from 'lucide-react';
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
  /** View: property rows inside DetailSection. Form: bordered rows like tasks edit. */
  variant?: 'view' | 'form';
  showSectionHeader?: boolean;
  className?: string;
};

const FORM_ROW_CLASS = 'rounded-lg border border-border p-4';

export function CupPropertiesFields({
  values,
  onVisibleChange,
  onSanctionedChange,
  onFeaturedChange,
  variant = 'view',
  showSectionHeader = false,
  className,
}: CupPropertiesFieldsProps) {
  const { t } = useTranslation();

  const rows = (
    <>
      <PropertyRow
        variant={variant}
        label={t('cups.propertyPublic')}
        value={values.visible}
        onChange={onVisibleChange}
      />
      <PropertyRow
        variant={variant}
        label={t('cups.propertySanctioned')}
        value={values.sanctioned}
        onChange={onSanctionedChange}
      />
      <PropertyRow
        variant={variant}
        label={t('cups.propertyFeatured')}
        value={values.featured}
        onChange={onFeaturedChange}
      />
    </>
  );

  if (variant === 'form') {
    return (
      <div className={cn('space-y-2', className)}>
        {showSectionHeader ? (
          <div className="mb-1 flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {t('cups.cupProperties')}
            </span>
          </div>
        ) : null}
        <div className="space-y-2">{rows}</div>
      </div>
    );
  }

  return <div className={className}>{rows}</div>;
}

function PropertyRow({
  variant,
  label,
  value,
  onChange,
}: {
  variant: 'view' | 'form';
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  if (variant === 'form') {
    return (
      <div className={FORM_ROW_CLASS}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <CupBooleanPropertySelect value={value} onChange={onChange} hideInlineLabel />
        </div>
      </div>
    );
  }

  return (
    <div className={DETAIL_PROP_ROW_CLASS}>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <CupBooleanPropertySelect value={value} onChange={onChange} hideInlineLabel />
    </div>
  );
}
