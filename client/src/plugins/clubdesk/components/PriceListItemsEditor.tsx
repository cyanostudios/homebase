import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DETAIL_EMPTY_STATE_CLASS } from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_ERROR_CLASS } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';

import type { ClubdeskPriceListItemPayload } from '../types/priceList';
import { canReorderItemWithinCategory } from '../utils/priceListItemOps';
import {
  LINE_ITEM_COMPACT_INPUT_CLASS,
  LINE_ITEM_COMPACT_LABEL_CLASS,
  LINE_ITEM_COMPACT_SELECT_CLASS,
  LINE_ITEM_EDIT_ROW_CLASS,
  LINE_ITEM_EDIT_SCROLL_CLASS,
  LINE_ITEM_FIELD_CLASS,
  PRICE_LIST_ITEM_EDIT_GRID_CLASS,
  PRICE_LIST_ITEM_EDIT_TRACK_CLASS,
  PRICE_LIST_ITEM_STACK_CLASS,
} from '../utils/priceListItemStyles';

export type PriceListItemsEditorProps = {
  items: ClubdeskPriceListItemPayload[];
  categoryOptions: string[];
  duplicatedIndexes: Set<number>;
  getTitleError?: (index: number) => string | undefined;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ClubdeskPriceListItemPayload>) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

function ItemActions({
  index,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: {
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-start pt-4">
      <RoundIconLabelButton
        type="button"
        icon={ArrowUp}
        label={t('clubdesk.priceList.moveItemUp')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveUp(index)}
        disabled={!canMoveUp}
      />
      <RoundIconLabelButton
        type="button"
        icon={ArrowDown}
        label={t('clubdesk.priceList.moveItemDown')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveDown(index)}
        disabled={!canMoveDown}
      />
      <RoundIconLabelButton
        type="button"
        icon={Copy}
        label={t('clubdesk.priceList.copyItem')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        contentClassName="text-green-600 dark:text-green-400"
        onClick={() => onDuplicate(index)}
      />
      <RoundIconLabelButton
        type="button"
        icon={Trash2}
        label={t('clubdesk.priceList.removeItem')}
        variant="dangerSoft"
        size="xs"
        expandOnHover={false}
        onClick={() => onDelete(index)}
      />
    </div>
  );
}

export function PriceListItemsEditor({
  items,
  categoryOptions,
  duplicatedIndexes,
  getTitleError,
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: PriceListItemsEditorProps) {
  const { t } = useTranslation();
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const handleDeleteClick = (index: number) => {
    const item = items[index];
    const hasContent =
      (item.title?.trim() ?? '') !== '' ||
      (item.description?.replace(/<[^>]*>/g, '').trim() ?? '') !== '' ||
      (item.price ?? 0) !== 0;
    if (hasContent) {
      setPendingDeleteIndex(index);
    } else {
      onRemove(index);
    }
  };

  const addButton = (
    <RoundIconLabelButton
      type="button"
      icon={Plus}
      label={t('clubdesk.priceList.addItem')}
      variant="soft"
      size="xs"
      alwaysExpanded
      onClick={onAdd}
    />
  );

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.priceList.noItemsYet')}</p>
          <div className="mt-3 flex justify-center">{addButton}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className={LINE_ITEM_EDIT_SCROLL_CLASS}>
            <div className={PRICE_LIST_ITEM_EDIT_TRACK_CLASS}>
              {items.map((item, index) => {
                const titleError = getTitleError?.(index);
                const isDuplicated = duplicatedIndexes.has(index);
                return (
                  <div
                    key={
                      item.clientKey ||
                      `price-list-item-${item.sequenceOrder}-${item.category ?? ''}-${item.title}`
                    }
                    className={cn(
                      LINE_ITEM_EDIT_ROW_CLASS,
                      isDuplicated && 'bg-green-50 dark:bg-green-950/30',
                    )}
                  >
                    <div className={PRICE_LIST_ITEM_EDIT_GRID_CLASS}>
                      <div className={PRICE_LIST_ITEM_STACK_CLASS}>
                        <div className={LINE_ITEM_FIELD_CLASS}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('clubdesk.priceList.title')}
                          </Label>
                          <Input
                            value={item.title}
                            onChange={(e) => onUpdate(index, { title: e.target.value })}
                            placeholder={t('clubdesk.priceList.itemTitlePlaceholder')}
                            className={cn(
                              LINE_ITEM_COMPACT_INPUT_CLASS,
                              titleError && FORM_INPUT_ERROR_CLASS,
                            )}
                          />
                        </div>
                        <div className={LINE_ITEM_FIELD_CLASS}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('clubdesk.priceList.price')}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              onUpdate(index, { price: Number(e.target.value) || 0 })
                            }
                            className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'text-right')}
                          />
                        </div>
                        <div className={LINE_ITEM_FIELD_CLASS}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('clubdesk.priceList.category')}
                          </Label>
                          <Select
                            value={item.category?.trim() ? item.category : '__none__'}
                            onValueChange={(value) =>
                              onUpdate(
                                index,
                                value === '__none__' ? { category: null } : { category: value },
                              )
                            }
                          >
                            <SelectTrigger className={LINE_ITEM_COMPACT_SELECT_CLASS}>
                              <SelectValue
                                placeholder={t('clubdesk.priceList.categoryPlaceholder')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                {t('clubdesk.priceList.categoryNone')}
                              </SelectItem>
                              {categoryOptions.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className={cn(LINE_ITEM_FIELD_CLASS, 'h-full')}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.priceList.description')}
                        </Label>
                        <Textarea
                          value={item.description ?? ''}
                          onChange={(e) => {
                            const html = e.target.value;
                            onUpdate(index, {
                              description: isEmptyRichText(html) ? null : html,
                            });
                          }}
                          rows={5}
                          placeholder={t('clubdesk.priceList.itemDescriptionPlaceholder')}
                          className={cn(
                            LINE_ITEM_COMPACT_INPUT_CLASS,
                            'min-h-[6.5rem] flex-1 resize-y py-1.5',
                          )}
                        />
                      </div>
                      <ItemActions
                        index={index}
                        canMoveUp={canReorderItemWithinCategory(items, index, -1)}
                        canMoveDown={canReorderItemWithinCategory(items, index, 1)}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        onDuplicate={onDuplicate}
                        onDelete={handleDeleteClick}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">{addButton}</div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteIndex !== null}
        title={t('clubdesk.priceList.removeItem')}
        message={t('clubdesk.priceList.removeItemConfirm', {
          defaultValue: 'Remove this item from the price list?',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (pendingDeleteIndex !== null) {
            onRemove(pendingDeleteIndex);
          }
          setPendingDeleteIndex(null);
        }}
        onCancel={() => setPendingDeleteIndex(null)}
      />
    </>
  );
}
