import { Check, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QC_STATUS_BADGE_COLORS, BADGE_SELECT_ITEM_CLASS } from '@/core/ui/badgeStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';

const VALUE_YES = 'true';
const VALUE_NO = 'false';

function boolToSelectValue(value: boolean): string {
  return value ? VALUE_YES : VALUE_NO;
}

function selectValueToBool(value: string): boolean {
  return value === VALUE_YES;
}

function YesNoBadge({ value }: { value: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusOutlineBadge
      icon={value ? Check : X}
      className={value ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.neutral}
    >
      {value ? t('common.yes') : t('common.no')}
    </StatusOutlineBadge>
  );
}

export interface CupBooleanPropertySelectProps {
  value: boolean;
  onChange: (value: boolean) => void;
  hideInlineLabel?: boolean;
}

export function CupBooleanPropertySelect({
  value,
  onChange,
  hideInlineLabel = false,
}: CupBooleanPropertySelectProps) {
  const selectEl = (
    <Select
      value={boolToSelectValue(value)}
      onValueChange={(next) => onChange(selectValueToBool(next))}
    >
      <SelectTrigger className="h-9 w-[180px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-xs">
        <SelectValue>
          <YesNoBadge value={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
        <SelectItem value={VALUE_YES} className={BADGE_SELECT_ITEM_CLASS}>
          <YesNoBadge value={true} />
        </SelectItem>
        <SelectItem value={VALUE_NO} className={BADGE_SELECT_ITEM_CLASS}>
          <YesNoBadge value={false} />
        </SelectItem>
      </SelectContent>
    </Select>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{selectEl}</div>;
  }

  return selectEl;
}
