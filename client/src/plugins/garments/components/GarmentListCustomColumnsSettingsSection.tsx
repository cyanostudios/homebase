import { Grip, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import type { GarmentCheckboxColumn } from '../types/garments';
import {
  MAX_CHECKBOX_COLUMNS,
  PAID_COLUMN_ID,
  addPaidCheckboxColumn,
  createCustomCheckboxColumn,
  isRemovablePersonCheckboxColumnId,
  removeCustomCheckboxColumn,
  reorderPersonCheckboxColumnIds,
  setPersonCheckboxColumnHidden,
} from '../utils/customCheckboxColumns';

export type GarmentListCustomColumnsSettingsSectionProps = {
  title: string;
  hint: string;
  /** Full list checkboxColumns length (for 50-cap). */
  totalColumnCount: number;
  columns: GarmentCheckboxColumn[];
  onChange: (next: GarmentCheckboxColumn[]) => void;
};

export function GarmentListCustomColumnsSettingsSection({
  title,
  hint,
  totalColumnCount,
  columns,
  onChange,
}: GarmentListCustomColumnsSettingsSectionProps) {
  const { t } = useTranslation();
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const atCap = totalColumnCount >= MAX_CHECKBOX_COLUMNS;
  const deletingColumn = columns.find((col) => col.id === deletingId);
  const hasPaid = columns.some((col) => col.id === PAID_COLUMN_ID);
  const order = columns.map((col) => col.id);

  const columnLabel = (col: GarmentCheckboxColumn) =>
    col.id === PAID_COLUMN_ID ? t('garments.columnStatus.betalt') : col.label;

  const handleRestorePaid = () => {
    try {
      onChange(addPaidCheckboxColumn(columns));
      setAddError(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'MAX_CHECKBOX_COLUMNS') {
        setAddError(t('garments.customColumnsMaxReached'));
      } else {
        setAddError(t('garments.customColumnsSaveFailed'));
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggingColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingColumnId && draggingColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const rawSource = e.dataTransfer.getData('text/plain') || draggingColumnId;
    if (rawSource && order.includes(rawSource)) {
      const nextOrder = reorderPersonCheckboxColumnIds(order, rawSource, targetId);
      const byId = new Map(columns.map((col) => [col.id, col]));
      onChange(
        nextOrder
          .map((id, index) => {
            const col = byId.get(id);
            return col ? { ...col, sortOrder: index } : null;
          })
          .filter((col): col is GarmentCheckboxColumn => col != null),
      );
    }
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  const handleDragEnd = () => {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  const handleAdd = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) {
      return;
    }
    if (atCap) {
      setAddError(t('garments.customColumnsMaxReached'));
      return;
    }
    try {
      if (totalColumnCount >= MAX_CHECKBOX_COLUMNS) {
        throw new Error('MAX_CHECKBOX_COLUMNS');
      }
      const maxSort = columns.reduce((max, col) => Math.max(max, col.sortOrder ?? 0), -1);
      const added = createCustomCheckboxColumn(trimmed, maxSort + 1);
      onChange([...columns, added]);
      setDraftLabel('');
      setAddError(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'MAX_CHECKBOX_COLUMNS') {
        setAddError(t('garments.customColumnsMaxReached'));
      } else {
        setAddError(t('garments.customColumnsSaveFailed'));
      }
    }
  };

  return (
    <>
      <DetailSection title={title} className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{hint}</p>
          <p className="text-sm text-muted-foreground">{t('garments.customColumnsSystemNote')}</p>

          <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
            {columns.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">
                {t('garments.customColumnsEmpty')}
              </li>
            ) : null}
            {columns.map((col) => {
              const removable = isRemovablePersonCheckboxColumnId(col.id);
              const isVisible = !col.hidden;
              const label = columnLabel(col);
              return (
                <li
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.id)}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => {
                    if (dragOverColumnId === col.id) {
                      setDragOverColumnId(null);
                    }
                  }}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                    draggingColumnId === col.id && 'opacity-50',
                    dragOverColumnId === col.id && 'bg-muted/60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Grip
                      className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {removable ? (
                      <RoundIconLabelButton
                        type="button"
                        size="xs"
                        icon={Trash2}
                        label={t('garments.customColumnsDelete')}
                        variant="dangerSoft"
                        expandOnHover={false}
                        onClick={() => setDeletingId(col.id)}
                      />
                    ) : null}
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        onChange(setPersonCheckboxColumnHidden(columns, col.id, !checked));
                      }}
                      aria-label={t('common.showColumn', { column: label })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {!hasPaid ? (
            <RoundIconLabelButton
              type="button"
              icon={Plus}
              label={t('garments.customColumnsRestorePaid')}
              variant="secondary"
              size="xs"
              alwaysExpanded
              disabled={atCap}
              onClick={handleRestorePaid}
            />
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Input
                value={draftLabel}
                onChange={(e) => {
                  setDraftLabel(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder={t('garments.customColumnsAddPlaceholder')}
                aria-label={t('garments.customColumnsAddPlaceholder')}
                className="h-9"
                disabled={atCap}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <RoundIconLabelButton
              type="button"
              icon={Plus}
              label={t('garments.customColumnsAdd')}
              variant="soft"
              size="xs"
              alwaysExpanded
              disabled={atCap || !draftLabel.trim()}
              onClick={handleAdd}
            />
          </div>

          {addError || atCap ? (
            <p role="status" className="text-xs text-destructive">
              {addError ?? t('garments.customColumnsMaxReached')}
            </p>
          ) : null}
        </div>
      </DetailSection>

      <ConfirmDialog
        isOpen={deletingId != null}
        title={t('garments.customColumnsDelete')}
        message={t('garments.customColumnsDeleteConfirm', {
          label: deletingColumn ? columnLabel(deletingColumn) : '',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (deletingId) {
            onChange(removeCustomCheckboxColumn(columns, deletingId));
          }
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
