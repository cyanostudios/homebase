import { Inbox } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BADGE_SELECT_ITEM_CLASS, BADGE_SELECT_TRIGGER_CLASS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

import { useRequests } from '../hooks/useRequests';
import { getTypeLabel, type Request } from '../types/requests';

interface RequestTypeSelectProps {
  request: Pick<Request, 'requestType'>;
  onTypeChange: (requestType: string) => void;
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists / quick context. */
  compact?: boolean;
}

function TypeLabel({ typeKey, compact = false }: { typeKey: string; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground',
        compact ? 'text-[10px]' : 'text-xs',
      )}
    >
      <Inbox className={cn('shrink-0', compact ? 'size-3' : 'size-3.5')} aria-hidden />
      <span className="min-w-0 truncate">{getTypeLabel(typeKey, t)}</span>
    </span>
  );
}

export function RequestTypeSelect({
  request,
  onTypeChange,
  hideInlineLabel = false,
  compact = false,
}: RequestTypeSelectProps) {
  const { t } = useTranslation();
  const { requestTypes } = useRequests();

  const options = React.useMemo(() => {
    const keys = requestTypes.map((type) => type.key);
    const current = String(request.requestType || '').trim();
    if (current && !keys.includes(current)) {
      return [current, ...keys];
    }
    return keys;
  }, [request.requestType, requestTypes]);

  const selectEl = (
    <Select value={request.requestType} onValueChange={onTypeChange}>
      <SelectTrigger
        className={cn(
          BADGE_SELECT_TRIGGER_CLASS,
          compact ? 'h-7 w-[130px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder={t('requests.form.requestType')}>
          <TypeLabel typeKey={request.requestType} compact={compact} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {options.map((typeKey) => (
          <SelectItem key={typeKey} value={typeKey} className={BADGE_SELECT_ITEM_CLASS}>
            <TypeLabel typeKey={typeKey} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{selectEl}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('requests.form.requestType')}
      </div>
      {selectEl}
    </div>
  );
}
