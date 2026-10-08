import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const PAYMENT_TERMS_PRESETS = ['0', '15', '30', '60'] as const;
export const PAYMENT_TERMS_CUSTOM = '__custom__';
export const DEFAULT_CUSTOM_PAYMENT_TERMS_DAYS = '14';

export function isPresetPaymentTerms(value: string): boolean {
  return (PAYMENT_TERMS_PRESETS as readonly string[]).includes(value);
}

export function clampPaymentTermsDaysInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') {
    return '0';
  }
  const days = Math.min(3650, Number.parseInt(digits, 10));
  if (!Number.isFinite(days)) {
    return '0';
  }
  return String(days);
}

interface PaymentTermsFieldProps {
  id: string;
  value: string;
  onChange: (nextDays: string) => void;
  selectClassName?: string;
  inputClassName?: string;
  className?: string;
}

/**
 * Preset payment terms (0/15/30/60) plus Custom with a days input beside the select.
 * Value is always a day count string so contacts and invoices stay in sync.
 */
export function PaymentTermsField({
  id,
  value,
  onChange,
  selectClassName,
  inputClassName,
  className,
}: PaymentTermsFieldProps) {
  const { t } = useTranslation();
  const valueStr = String(value ?? '');
  const custom = !isPresetPaymentTerms(valueStr);

  return (
    <div className={cn('flex min-w-0 flex-nowrap items-center justify-end gap-1.5', className)}>
      <NativeSelect
        id={id}
        value={custom ? PAYMENT_TERMS_CUSTOM : valueStr}
        onChange={(e) => {
          const next = e.target.value;
          if (next === PAYMENT_TERMS_CUSTOM) {
            onChange(
              isPresetPaymentTerms(valueStr)
                ? DEFAULT_CUSTOM_PAYMENT_TERMS_DAYS
                : valueStr || DEFAULT_CUSTOM_PAYMENT_TERMS_DAYS,
            );
            return;
          }
          onChange(next);
        }}
        className={cn(selectClassName, 'w-auto min-w-[7.5rem] max-w-[9rem] shrink-0')}
      >
        <option value="0">
          {t('common.paymentTermsImmediate', { defaultValue: 'Immediate' })}
        </option>
        <option value="15">
          {t('common.paymentTermsDays', { defaultValue: '{{count}} days', count: 15 })}
        </option>
        <option value="30">
          {t('common.paymentTermsDays', { defaultValue: '{{count}} days', count: 30 })}
        </option>
        <option value="60">
          {t('common.paymentTermsDays', { defaultValue: '{{count}} days', count: 60 })}
        </option>
        <option value={PAYMENT_TERMS_CUSTOM}>
          {t('common.paymentTermsCustom', { defaultValue: 'Custom…' })}
        </option>
      </NativeSelect>
      {custom ? (
        <>
          <Input
            id={`${id}-custom`}
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            step={1}
            value={valueStr}
            onChange={(e) => onChange(clampPaymentTermsDaysInput(e.target.value))}
            className={cn(inputClassName, 'w-16 max-w-[4.5rem] shrink-0 text-right')}
            aria-label={t('common.paymentTermsCustomDays', { defaultValue: 'Custom days' })}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('common.paymentTermsCustomDaysSuffix', { defaultValue: 'days' })}
          </span>
        </>
      ) : null}
    </div>
  );
}
