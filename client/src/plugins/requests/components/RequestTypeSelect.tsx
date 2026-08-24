import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-7 w-[130px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder={t('requests.form.requestType')}>
          <span className={cn('truncate font-medium', compact ? 'text-[10px]' : 'text-xs')}>
            {getTypeLabel(request.requestType, t)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {options.map((typeKey) => (
          <SelectItem
            key={typeKey}
            value={typeKey}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            {getTypeLabel(typeKey, t)}
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
