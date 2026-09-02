import { Grip } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import type { TableColumnsPref } from '@/core/list/tableColumnsPref';
import { cn } from '@/lib/utils';

export type TableColumnsSettingsSectionProps<TColumnId extends string> = {
  title: string;
  hint: string;
  pref: TableColumnsPref<TColumnId>;
  requiredColumnId: TColumnId;
  labelFor: (columnId: TColumnId) => string;
  isColumnId: (value: unknown) => value is TColumnId;
  reorder: (order: TColumnId[], sourceId: TColumnId, targetId: TColumnId) => TColumnId[];
  setHidden: (
    pref: TableColumnsPref<TColumnId>,
    columnId: TColumnId,
    hidden: boolean,
  ) => TableColumnsPref<TColumnId>;
  onChange: (next: TableColumnsPref<TColumnId>) => void;
};

export function TableColumnsSettingsSection<TColumnId extends string>({
  title,
  hint,
  pref,
  requiredColumnId,
  labelFor,
  isColumnId,
  reorder,
  setHidden,
  onChange,
}: TableColumnsSettingsSectionProps<TColumnId>) {
  const { t } = useTranslation();
  const [draggingColumnId, setDraggingColumnId] = useState<TColumnId | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TColumnId | null>(null);

  const handleDragStart = (e: React.DragEvent, columnId: TColumnId) => {
    setDraggingColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingColumnId && draggingColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: TColumnId) => {
    e.preventDefault();
    const rawSource = e.dataTransfer.getData('text/plain') || draggingColumnId;
    if (isColumnId(rawSource)) {
      onChange({
        ...pref,
        order: reorder(pref.order, rawSource, targetId),
      });
    }
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  const handleDragEnd = () => {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  return (
    <DetailSection title={title} className="pt-0">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
          {pref.order.map((columnId) => {
            const isVisible = !pref.hidden.includes(columnId);
            const isRequired = columnId === requiredColumnId;
            const label = labelFor(columnId);
            return (
              <li
                key={columnId}
                draggable
                onDragStart={(e) => handleDragStart(e, columnId)}
                onDragOver={(e) => handleDragOver(e, columnId)}
                onDrop={(e) => handleDrop(e, columnId)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => {
                  if (dragOverColumnId === columnId) {
                    setDragOverColumnId(null);
                  }
                }}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                  draggingColumnId === columnId && 'opacity-50',
                  dragOverColumnId === columnId && 'bg-muted/60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Grip
                    className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <Switch
                  checked={isVisible}
                  disabled={isRequired}
                  onCheckedChange={(checked) => {
                    onChange(setHidden(pref, columnId, !checked));
                  }}
                  aria-label={t('common.showColumn', { column: label })}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </DetailSection>
  );
}
