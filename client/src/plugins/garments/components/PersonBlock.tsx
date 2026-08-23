import { Edit, Trash2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DETAIL_LIST_ITEM_HOVER_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { GarmentCheckboxColumn, GarmentPerson } from '../types/garments';
import { translateCheckboxColumnLabel } from '../utils/checkboxColumnI18n';

function SizeField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-[5.5rem]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value?.trim() ? value : '—'}</div>
    </div>
  );
}

export function PersonBlock({
  person,
  columns,
  hideComment,
  readOnly,
  isEditing,
  editDraft,
  jerseyDup,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onToggleCheckbox,
  onDraftChange,
}: {
  person: GarmentPerson;
  columns: GarmentCheckboxColumn[];
  hideComment: boolean;
  readOnly: boolean;
  isEditing: boolean;
  editDraft: Partial<GarmentPerson>;
  jerseyDup: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onToggleCheckbox: (columnId: string) => void;
  onDraftChange: (patch: Partial<GarmentPerson>) => void;
}) {
  const { t } = useTranslation();
  const checkboxValues = isEditing
    ? (editDraft.checkboxValues ?? person.checkboxValues ?? {})
    : (person.checkboxValues ?? {});
  const jersey = isEditing ? (editDraft.jerseyNumber ?? '') : (person.jerseyNumber ?? '');
  const jerseyTrim = jersey.trim();
  const comment = person.comment?.trim();

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <article className={cn('px-3 py-3', DETAIL_LIST_ITEM_HOVER_CLASS)}>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <Input
                value={editDraft.name ?? ''}
                onChange={(e) => onDraftChange({ name: e.target.value })}
                aria-label={t('garments.personName')}
                className="h-9 text-sm"
              />
            ) : (
              <h3 className="text-sm font-medium leading-snug break-words">{person.name || '—'}</h3>
            )}
            {isEditing && !hideComment ? (
              <Input
                value={editDraft.comment ?? ''}
                onChange={(e) => onDraftChange({ comment: e.target.value })}
                aria-label={t('garments.comment')}
                placeholder={t('garments.comment')}
                className="mt-2 h-8 text-xs"
              />
            ) : null}
            {!isEditing && !hideComment && comment ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{comment}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-start gap-2">
            {isEditing ? (
              <Input
                value={editDraft.jerseyNumber ?? ''}
                onChange={(e) => onDraftChange({ jerseyNumber: e.target.value })}
                aria-label={t('garments.jerseyNumber')}
                className={cn('h-9 w-16 text-sm', jerseyDup && 'border-amber-400')}
              />
            ) : jerseyTrim ? (
              <span
                className={cn(
                  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm font-medium',
                  jerseyDup && 'border-amber-300 text-amber-700 dark:text-amber-300',
                )}
              >
                #{jerseyTrim}
              </span>
            ) : null}

            {!readOnly ? (
              isEditing ? (
                <div className="inline-flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="h-9 px-3 text-xs"
                    onClick={onSave}
                  >
                    {t('common.save')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    icon={X}
                    aria-label={t('common.cancel')}
                    onClick={onCancel}
                  />
                </div>
              ) : (
                <div className="inline-flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    icon={Edit}
                    aria-label={t('common.edit')}
                    onClick={onStartEdit}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs text-red-600"
                    icon={Trash2}
                    aria-label={t('common.delete')}
                    onClick={onDelete}
                  />
                </div>
              )
            ) : null}
          </div>
        </div>

        {jerseyDup ? (
          <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {t('garments.jerseyDuplicateThisPerson')}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          {isEditing ? (
            <>
              <div className="min-w-[5.5rem]">
                <div className="text-xs text-muted-foreground">{t('garments.shirtSize')}</div>
                <Input
                  value={editDraft.shirtSize ?? ''}
                  onChange={(e) => onDraftChange({ shirtSize: e.target.value })}
                  className="h-8 w-24 text-sm"
                />
              </div>
              <div className="min-w-[5.5rem]">
                <div className="text-xs text-muted-foreground">{t('garments.shortsSize')}</div>
                <Input
                  value={editDraft.shortsSize ?? ''}
                  onChange={(e) => onDraftChange({ shortsSize: e.target.value })}
                  className="h-8 w-24 text-sm"
                />
              </div>
              <div className="min-w-[5.5rem]">
                <div className="text-xs text-muted-foreground">{t('garments.socksSize')}</div>
                <Input
                  value={editDraft.socksSize ?? ''}
                  onChange={(e) => onDraftChange({ socksSize: e.target.value })}
                  className="h-8 w-24 text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <SizeField label={t('garments.shirtSize')} value={person.shirtSize} />
              <SizeField label={t('garments.shortsSize')} value={person.shortsSize} />
              <SizeField label={t('garments.socksSize')} value={person.socksSize} />
            </>
          )}
        </div>

        {columns.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
            {columns.map((col) => (
              <label
                key={col.id}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs',
                  readOnly ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(checkboxValues[col.id])}
                  disabled={readOnly}
                  onChange={() => onToggleCheckbox(col.id)}
                  className="h-4 w-4 cursor-pointer"
                />
                <span>{translateCheckboxColumnLabel(t, col)}</span>
              </label>
            ))}
          </div>
        ) : null}
      </article>
    </li>
  );
}
