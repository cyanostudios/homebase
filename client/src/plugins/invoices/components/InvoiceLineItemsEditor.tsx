import { ArrowDown, ArrowUp, Copy, Plus, TextCursorInput, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { NativeSelect } from '@/components/ui/select';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import type { InvoiceLineItem } from '../types/invoices';
import {
  DEFAULT_INVOICE_LINE_ITEM_UNIT,
  INVOICE_LINE_ITEM_UNITS,
  calculateInvoiceLineItem,
} from '../types/invoices';
import { formatInvoiceAmount } from '../utils/formatInvoiceAmount';
import {
  LINE_ITEM_COMPACT_INPUT_CLASS,
  LINE_ITEM_COMPACT_LABEL_CLASS,
  LINE_ITEM_COMPACT_SELECT_CLASS,
  LINE_ITEM_EDIT_GRID_CLASS,
  LINE_ITEM_EDIT_ROW_CLASS,
  LINE_ITEM_EDIT_SCROLL_CLASS,
  LINE_ITEM_EDIT_TRACK_CLASS,
  LINE_ITEM_FIELD_CLASS,
  LINE_ITEM_MUTED_VALUE_CLASS,
  LINE_ITEM_VALUE_CLASS,
} from '../utils/invoiceLineItemStyles';

interface InvoiceLineItemsEditorProps {
  items: InvoiceLineItem[];
  duplicatedItemIds: Set<string>;
  onAdd: () => void;
  onAddTextField: () => void;
  onUpdate: (index: number, field: keyof InvoiceLineItem, value: any) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

function LineItemActions({
  index,
  itemsLength,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: {
  index: number;
  itemsLength: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-end">
      <RoundIconLabelButton
        type="button"
        icon={ArrowUp}
        label={t('common.moveUp')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveUp(index)}
        disabled={index === 0}
      />
      <RoundIconLabelButton
        type="button"
        icon={ArrowDown}
        label={t('common.moveDown')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveDown(index)}
        disabled={index === itemsLength - 1}
      />
      <RoundIconLabelButton
        type="button"
        icon={Copy}
        label={t('common.duplicate')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        contentClassName="text-green-600 dark:text-green-400"
        onClick={() => onDuplicate(index)}
      />
      <RoundIconLabelButton
        type="button"
        icon={Trash2}
        label={t('common.delete')}
        variant="dangerSoft"
        size="xs"
        expandOnHover={false}
        onClick={() => onDelete(index)}
      />
    </div>
  );
}

function AddLineButtons({
  onAdd,
  onAddTextField,
}: {
  onAdd: () => void;
  onAddTextField: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <RoundIconLabelButton
        type="button"
        icon={Plus}
        label={t('invoices.addItem')}
        variant="soft"
        size="xs"
        alwaysExpanded
        onClick={onAdd}
      />
      <RoundIconLabelButton
        type="button"
        icon={TextCursorInput}
        label={t('invoices.addField', { defaultValue: 'Add field' })}
        variant="secondary"
        size="xs"
        alwaysExpanded
        onClick={onAddTextField}
      />
    </div>
  );
}

export function InvoiceLineItemsEditor({
  items,
  duplicatedItemIds,
  onAdd,
  onAddTextField,
  onUpdate,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: InvoiceLineItemsEditorProps) {
  const { t } = useTranslation();
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const handleDeleteClick = (index: number) => {
    const item = items[index];
    const hasContent =
      (item.description?.trim() ?? '') !== '' ||
      (item.kind !== 'text' && (item.unitPrice ?? 0) > 0);
    if (hasContent) {
      setPendingDeleteIndex(index);
    } else {
      onRemove(index);
    }
  };

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">{t('invoices.noLineItems')}</p>
          <div className="mt-3 flex justify-center">
            <AddLineButtons onAdd={onAdd} onAddTextField={onAddTextField} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className={LINE_ITEM_EDIT_SCROLL_CLASS}>
            <div className={LINE_ITEM_EDIT_TRACK_CLASS}>
              {items.map((item, index) => {
                const isDuplicated = duplicatedItemIds.has(String(item.id));
                const isText = item.kind === 'text';
                const computed = isText ? item : calculateInvoiceLineItem(item);

                if (isText) {
                  return (
                    <div
                      key={item.id || index}
                      className={cn(
                        LINE_ITEM_EDIT_ROW_CLASS,
                        isDuplicated && 'bg-green-50 dark:bg-green-950/30',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div className={cn(LINE_ITEM_FIELD_CLASS, 'flex-1')}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('invoices.freeTextField', { defaultValue: 'Text field' })}
                          </Label>
                          <Input
                            value={item.description || ''}
                            onChange={(e) => onUpdate(index, 'description', e.target.value)}
                            placeholder={t('invoices.freeTextPlaceholder', {
                              defaultValue: 'Free text…',
                            })}
                            className={LINE_ITEM_COMPACT_INPUT_CLASS}
                          />
                        </div>
                        <LineItemActions
                          index={index}
                          itemsLength={items.length}
                          onMoveUp={onMoveUp}
                          onMoveDown={onMoveDown}
                          onDuplicate={onDuplicate}
                          onDelete={handleDeleteClick}
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id || index}
                    className={cn(
                      LINE_ITEM_EDIT_ROW_CLASS,
                      isDuplicated && 'bg-green-50 dark:bg-green-950/30',
                    )}
                  >
                    <div className={LINE_ITEM_EDIT_GRID_CLASS}>
                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.description')}
                        </Label>
                        <Input
                          value={item.description || ''}
                          onChange={(e) => onUpdate(index, 'description', e.target.value)}
                          placeholder={t('invoices.lineDescriptionPlaceholder')}
                          className={LINE_ITEM_COMPACT_INPUT_CLASS}
                        />
                      </div>

                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.table.qty')}
                        </Label>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) =>
                              onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'text-right')}
                          />
                          <NativeSelect
                            value={item.unit ?? DEFAULT_INVOICE_LINE_ITEM_UNIT}
                            onChange={(e) => onUpdate(index, 'unit', e.target.value)}
                            className={LINE_ITEM_COMPACT_SELECT_CLASS}
                            aria-label={t('invoices.table.unit', { defaultValue: 'Unit' })}
                          >
                            <option value="">
                              {t('invoices.units.empty', { defaultValue: '-' })}
                            </option>
                            {INVOICE_LINE_ITEM_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {t(`invoices.units.${unit}`, { defaultValue: unit })}
                              </option>
                            ))}
                            {item.unit &&
                            !(INVOICE_LINE_ITEM_UNITS as readonly string[]).includes(item.unit) ? (
                              <option value={item.unit}>{item.unit}</option>
                            ) : null}
                          </NativeSelect>
                        </div>
                      </div>

                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.table.unitPrice')}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) =>
                            onUpdate(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'text-right')}
                        />
                      </div>

                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.table.discountPercent')}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount || 0}
                          onChange={(e) =>
                            onUpdate(index, 'discount', parseFloat(e.target.value) || 0)
                          }
                          className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'text-right')}
                        />
                      </div>

                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.table.vatPercent')}
                        </Label>
                        <NativeSelect
                          value={item.vatRate ?? 25}
                          onChange={(e) =>
                            onUpdate(index, 'vatRate', parseFloat(e.target.value) || 0)
                          }
                          className={LINE_ITEM_COMPACT_SELECT_CLASS}
                        >
                          <option value={0}>0%</option>
                          <option value={6}>6%</option>
                          <option value={12}>12%</option>
                          <option value={25}>25%</option>
                        </NativeSelect>
                      </div>

                      <div className={LINE_ITEM_FIELD_CLASS}>
                        <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                          {t('invoices.table.total')}
                        </Label>
                        <div className="flex h-7 items-center justify-start gap-1.5">
                          <span className={cn(LINE_ITEM_VALUE_CLASS, 'font-semibold leading-none')}>
                            {formatInvoiceAmount(computed.lineSubtotalAfterDiscount || 0)}
                          </span>
                          {(computed.vatAmount || 0) > 0 ? (
                            <span
                              className={cn(LINE_ITEM_MUTED_VALUE_CLASS, 'text-[9px] leading-none')}
                            >
                              VAT {formatInvoiceAmount(computed.vatAmount || 0)}
                            </span>
                          ) : null}
                        </div>
                        {(computed.discountAmount || 0) > 0 ? (
                          <span
                            className={cn(
                              LINE_ITEM_MUTED_VALUE_CLASS,
                              'text-left text-[9px] leading-none',
                            )}
                          >
                            −{formatInvoiceAmount(computed.discountAmount || 0)}
                          </span>
                        ) : null}
                      </div>

                      <LineItemActions
                        index={index}
                        itemsLength={items.length}
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
          <AddLineButtons onAdd={onAdd} onAddTextField={onAddTextField} />
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteIndex !== null}
        title={t('invoices.deleteLineItemTitle')}
        message={t('invoices.deleteLineItemMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (pendingDeleteIndex !== null) {
            onRemove(pendingDeleteIndex);
            setPendingDeleteIndex(null);
          }
        }}
        onCancel={() => setPendingDeleteIndex(null)}
        variant="danger"
      />
    </>
  );
}
