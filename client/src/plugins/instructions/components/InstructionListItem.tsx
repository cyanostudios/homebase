import { ArrowDown, ArrowUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { Instruction, PublicationStatus } from '../types/instructions';
import type { InstructionColumnCount } from '../utils/instructionColumnCount';

function truncateText(value: string, maxLength = 150): string {
  const plain = value.trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

export function InstructionListItem({
  instruction,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 2,
  onStatusChange,
  canReorder = false,
  reorderDisabled = false,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}: {
  instruction: Instruction;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  columnCount?: InstructionColumnCount;
  onStatusChange?: (status: PublicationStatus) => void;
  canReorder?: boolean;
  reorderDisabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { t } = useTranslation();
  const excerpt = instruction.description ? truncateText(instruction.description) : '';
  const updatedLabel = instruction.updatedAt
    ? new Date(instruction.updatedAt).toLocaleDateString()
    : null;
  const stepCount = instruction.stepCount ?? instruction.steps?.length ?? 0;
  const isPublished = instruction.publicationStatus === 'published';
  const metaOnTop = columnCount === 1;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="truncate">{t('instructions.stepCount', { count: stepCount })}</span>
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  );

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest('input[type="checkbox"], button, [role="combobox"]')
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(instruction)}
      data-plugin-name="instructions"
      role="button"
      tabIndex={0}
      aria-label={t('instructions.openInstruction', { title: instruction.title })}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <Badge
              variant={isPublished ? 'default' : 'secondary'}
              className={cn(
                'text-[10px]',
                isPublished &&
                  'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
              )}
            >
              {isPublished ? t('instructions.status.published') : t('instructions.status.draft')}
            </Badge>
            {instruction.category?.trim() ? (
              <Badge variant="outline" className="text-[10px]">
                {instruction.category.trim()}
              </Badge>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {canReorder ? (
              <div
                className="flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={ArrowUp}
                  className="h-7 w-7 px-0"
                  disabled={reorderDisabled || isFirst}
                  aria-label={t('instructions.moveGuideUp')}
                  onClick={() => onMoveUp?.()}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={ArrowDown}
                  className="h-7 w-7 px-0"
                  disabled={reorderDisabled || isLast}
                  aria-label={t('instructions.moveGuideDown')}
                  onClick={() => onMoveDown?.()}
                />
              </div>
            ) : null}
            {onStatusChange ? (
              <div
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Select
                  value={instruction.publicationStatus}
                  onValueChange={(value) => onStatusChange(value as PublicationStatus)}
                >
                  <SelectTrigger
                    className="h-7 w-[110px] rounded-md border-border/30 bg-background px-2 text-[10px] shadow-none"
                    aria-label={t('instructions.publicationStatus')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-xl">
                    <SelectItem value="draft" className="rounded-md text-xs">
                      {t('instructions.status.draft')}
                    </SelectItem>
                    <SelectItem value="published" className="rounded-md text-xs">
                      {t('instructions.status.published')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{instruction.title}</h3>

        {excerpt ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
            {excerpt}
          </p>
        ) : null}

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
