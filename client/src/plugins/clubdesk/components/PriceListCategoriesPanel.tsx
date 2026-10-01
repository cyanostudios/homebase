import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { listReorderRowStyle } from '@/core/ui/listReorderTransition';

import { PriceListAddCategoryField } from './PriceListAddCategoryField';

export type PriceListCategoryEntry = {
  id?: string | null;
  name: string;
  enabled?: boolean;
};

export function PriceListCategoriesPanel({
  enabled,
  onEnabledChange,
  entries,
  newCategoryName,
  onNewCategoryNameChange,
  onAdd,
  onDelete,
  onMove,
  onEntryEnabledChange,
  busy = false,
  error = null,
}: {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  entries: PriceListCategoryEntry[];
  newCategoryName: string;
  onNewCategoryNameChange: (value: string) => void;
  onAdd: () => void;
  onDelete: (name: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onEntryEnabledChange: (entry: PriceListCategoryEntry, enabled: boolean) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="price-list-categories-enabled" className="text-sm font-medium">
            {t('clubdesk.priceList.categoriesEnabled')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('clubdesk.priceList.categoriesEnabledHint')}
          </p>
        </div>
        <Switch
          id="price-list-categories-enabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={busy}
          aria-label={t('clubdesk.priceList.categoriesEnabled')}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t('clubdesk.priceList.categoriesOrderHint')}</p>
      <p className="text-xs text-muted-foreground">{t('clubdesk.priceList.categoryEnabledHint')}</p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('clubdesk.priceList.noCategories')}</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={`${entry.id ?? 'local'}-${entry.name}`}
              className="line-item-reorder-row flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
              style={listReorderRowStyle(`${entry.id ?? 'local'}-${entry.name}`)}
            >
              <span
                className={`min-w-0 flex-1 truncate text-xs font-medium ${entry.enabled === false ? 'text-muted-foreground' : ''}`}
              >
                {entry.name}
              </span>
              <Switch
                checked={entry.enabled !== false}
                onCheckedChange={(next) => onEntryEnabledChange(entry, next)}
                disabled={busy}
                aria-label={t('clubdesk.priceList.categoryEnabled', { name: entry.name })}
              />
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={ArrowUp}
                  className="h-7 w-7 px-0"
                  disabled={busy || index === 0}
                  aria-label={t('clubdesk.priceList.moveCategoryUp', { name: entry.name })}
                  onClick={() => onMove(index, -1)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={ArrowDown}
                  className="h-7 w-7 px-0"
                  disabled={busy || index === entries.length - 1}
                  aria-label={t('clubdesk.priceList.moveCategoryDown', { name: entry.name })}
                  onClick={() => onMove(index, 1)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="h-7 w-7 px-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  aria-label={t('clubdesk.priceList.removeCategory', { name: entry.name })}
                  onClick={() => onDelete(entry.name)}
                  disabled={busy}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <PriceListAddCategoryField
        value={newCategoryName}
        onChange={onNewCategoryNameChange}
        onAdd={onAdd}
        disabled={busy}
      />
    </div>
  );
}
