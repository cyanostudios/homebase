import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import type { InvoiceLineItem } from '../types/invoices';

interface InvoiceLineItemsEditorProps {
  items: InvoiceLineItem[];
  duplicatedItemIds: Set<string>;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof InvoiceLineItem, value: any) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

const NUM_INPUT_CLASS =
  'h-8 px-2 py-1 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]';

export function InvoiceLineItemsEditor({
  items,
  duplicatedItemIds,
  onAdd,
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
    const hasContent = (item.description?.trim() ?? '') !== '' || (item.unitPrice ?? 0) > 0;
    if (hasContent) {
      setPendingDeleteIndex(index);
    } else {
      onRemove(index);
    }
  };

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('invoices.noLineItems')}</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Plus}
            className="mt-3 h-9 px-3 text-xs"
            onClick={onAdd}
          >
            {t('invoices.addItem')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[800px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-8 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.description')}
                  </th>
                  <th className="w-16 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.qty')}
                  </th>
                  <th className="w-24 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.unitPrice')}
                  </th>
                  <th className="w-16 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.discountPercent')}
                  </th>
                  <th className="w-20 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.vatPercent')}
                  </th>
                  <th className="w-20 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.discount')}
                  </th>
                  <th className="w-20 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.vat')}
                  </th>
                  <th className="w-24 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('invoices.table.total')}
                  </th>
                  <th className="w-28 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, index) => (
                  <tr
                    key={item.id || index}
                    className={cn(
                      'group',
                      duplicatedItemIds.has(String(item.id)) && 'bg-green-50 dark:bg-green-950/30',
                    )}
                  >
                    <td className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2">
                      <Textarea
                        value={item.description || ''}
                        onChange={(e) => onUpdate(index, 'description', e.target.value)}
                        placeholder={t('invoices.lineDescriptionPlaceholder')}
                        rows={1}
                        className="h-auto min-h-[2.25rem] min-w-[160px] resize-none text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className={cn(NUM_INPUT_CLASS, 'w-16')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) =>
                          onUpdate(index, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                        className={cn(NUM_INPUT_CLASS, 'w-20')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount || 0}
                        onChange={(e) =>
                          onUpdate(index, 'discount', parseFloat(e.target.value) || 0)
                        }
                        className={cn(NUM_INPUT_CLASS, 'w-16')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <NativeSelect
                        value={item.vatRate ?? 25}
                        onChange={(e) =>
                          onUpdate(index, 'vatRate', parseFloat(e.target.value) || 0)
                        }
                        className="h-8 w-20 text-sm"
                      >
                        <option value={0}>0%</option>
                        <option value={6}>6%</option>
                        <option value={12}>12%</option>
                        <option value={25}>25%</option>
                      </NativeSelect>
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                      {(item.discountAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                      {(item.vatAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-foreground">
                      {(item.lineTotal || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          icon={ArrowUp}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onMoveUp(index)}
                          disabled={index === 0}
                          aria-label={t('common.moveUp')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          icon={ArrowDown}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onMoveDown(index)}
                          disabled={index === items.length - 1}
                          aria-label={t('common.moveDown')}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          icon={Copy}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onDuplicate(index)}
                          aria-label={t('common.duplicate')}
                        />
                        <Button
                          type="button"
                          variant="danger"
                          icon={Trash2}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteClick(index)}
                          aria-label={t('common.delete')}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="secondary" icon={Plus} size="sm" onClick={onAdd}>
            {t('invoices.addItem')}
          </Button>
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
