import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const VALUE_YES = 'true';
const VALUE_NO = 'false';

const YES_BADGE_CLASS =
  'border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300';
const NO_BADGE_CLASS =
  'border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300';

function boolToSelectValue(value: boolean): string {
  return value ? VALUE_YES : VALUE_NO;
}

function selectValueToBool(value: string): boolean {
  return value === VALUE_YES;
}

function YesNoBadge({ value }: { value: boolean }) {
  const { t } = useTranslation();
  const label = value ? t('common.yes') : t('common.no');
  return (
    <Badge
      variant="outline"
      className={cn('text-xs px-2 h-5', value ? YES_BADGE_CLASS : NO_BADGE_CLASS)}
    >
      {label}
    </Badge>
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
        <SelectItem value={VALUE_YES} className="py-2 focus:bg-accent rounded-md text-xs">
          <YesNoBadge value={true} />
        </SelectItem>
        <SelectItem value={VALUE_NO} className="py-2 focus:bg-accent rounded-md text-xs">
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
