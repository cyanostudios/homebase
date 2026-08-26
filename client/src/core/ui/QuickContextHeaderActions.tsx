import { Edit, ExternalLink, X } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';

export function QuickContextHeaderActions({
  onOpen,
  onEdit,
  onClose,
  editLabel,
  closeLabel,
  className,
}: {
  onOpen?: () => void;
  onEdit: () => void;
  onClose?: () => void;
  editLabel: string;
  closeLabel: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-1', className)}>
      {onOpen ? (
        <RoundIconLabelButton
          type="button"
          onClick={onOpen}
          icon={ExternalLink}
          label={t('common.open')}
          variant="primary"
          alwaysExpanded
        />
      ) : null}
      <RoundIconLabelButton
        type="button"
        onClick={onEdit}
        icon={Edit}
        label={editLabel}
        variant="primary"
      />
      {onClose ? (
        <RoundIconLabelButton
          type="button"
          onClick={onClose}
          icon={X}
          label={closeLabel}
          variant="secondary"
          expandOnHover={false}
        />
      ) : null}
    </div>
  );
}

export function QuickContextOpenFullFooter({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex justify-end border-t border-border/50 px-4 py-3', className)}>
      <RoundIconLabelButton
        type="button"
        onClick={onOpen}
        icon={ExternalLink}
        label={t('common.openFullProfile')}
        variant="primary"
        alwaysExpanded
      />
    </div>
  );
}
