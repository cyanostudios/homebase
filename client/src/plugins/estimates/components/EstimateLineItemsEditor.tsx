import React from 'react';

import type { InvoiceLineItem } from '@/plugins/invoices/types/invoices';
import { InvoiceLineItemsEditor } from '@/plugins/invoices/components/InvoiceLineItemsEditor';

import type { LineItem } from '../types/estimate';

interface EstimateLineItemsEditorProps {
  items: LineItem[];
  duplicatedItemIds: Set<string>;
  onAdd: () => void;
  onAddTextField: () => void;
  onUpdate: (index: number, field: keyof LineItem, value: unknown) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function EstimateLineItemsEditor(props: EstimateLineItemsEditorProps) {
  return (
    <InvoiceLineItemsEditor
      items={props.items as InvoiceLineItem[]}
      duplicatedItemIds={props.duplicatedItemIds}
      onAdd={props.onAdd}
      onAddTextField={props.onAddTextField}
      onUpdate={
        props.onUpdate as (index: number, field: keyof InvoiceLineItem, value: unknown) => void
      }
      onDuplicate={props.onDuplicate}
      onRemove={props.onRemove}
      onMoveUp={props.onMoveUp}
      onMoveDown={props.onMoveDown}
    />
  );
}
