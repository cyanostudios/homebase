import { ChevronDown, Plus, Save, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';
import { formatChannelInstanceLabel } from '@/plugins/channels/utils/formatChannelInstanceLabel';

import type {
  ProductCatalogViewDefinition,
  ProductFilterDefinitionsResponse,
} from '../api/productsApi';
import { productsApi } from '../api/productsApi';

import { newFilterRowId, type ProductCatalogFilterRow } from './productCatalogFilterTypes';

const CH_STATES: Array<{ id: 'active' | 'inactive'; label: string }> = [
  { id: 'active', label: 'Aktiv' },
  { id: 'inactive', label: 'Inte aktiv' },
];

const OP_LABEL: Record<string, string> = {
  eq: '=',
  in: 'en av',
  contains: 'innehåller',
  prefix: 'börjar med',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

type LookupItem = { id: string; name: string };

/** Så nollan kan ersättas med första siffran i stället för "04" i styrda number-fält. */
function selectIfZero(e: React.FocusEvent<HTMLInputElement>, n: number) {
  if (n === 0) {
    e.currentTarget.select();
  }
}

function defaultFilterRule(
  type: string,
  firstChannelId: number | null,
  firstInstanceId: number | null,
): ProductCatalogFilterRow {
  const id = newFilterRowId();
  switch (type) {
    case 'status':
      return { id, type, op: 'in', value: ['for sale'] };
    case 'condition':
      return { id, type, op: 'in', value: ['new'] };
    case 'quantity':
      return { id, type, op: 'gte', value: 0 };
    case 'channelPrice': {
      const iid = firstInstanceId && firstInstanceId > 0 ? firstInstanceId : 0;
      return { id, type, op: 'gte', value: { instanceId: iid, n: 0 } };
    }
    case 'brand':
    case 'supplier':
    case 'manufacturer':
      return { id, type, op: 'eq', value: 0 };
    case 'lagerplats':
      return { id, type, op: 'contains', value: 'a' };
    case 'sku':
    case 'ean':
    case 'gtin':
      return { id, type, op: 'contains', value: ' ' };
    case 'channelState':
      return {
        id,
        type,
        op: 'eq',
        value: {
          instanceId: firstChannelId && firstChannelId > 0 ? firstChannelId : 0,
          state: 'active',
        },
      };
    case 'list':
      return { id, type, op: 'eq', value: { mode: 'all' } };
    default:
      return { id, type: 'status', op: 'in', value: ['for sale'] };
  }
}

type RowEditorProps = {
  row: ProductCatalogFilterRow;
  onChange: (next: ProductCatalogFilterRow) => void;
  onRemove: () => void;
  meta: ProductFilterDefinitionsResponse;
  channelInstances: ChannelInstance[];
  lists: Array<{ id: string; name: string }>;
  brands: LookupItem[];
  suppliers: LookupItem[];
  manufacturers: LookupItem[];
};

function LookupMultiPicker(props: {
  items: LookupItem[];
  valueIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}) {
  const { items, valueIds, onChange, placeholder = 'Sök i listan…' } = props;
  const [q, setQ] = useState('');
  const set = new Set(valueIds);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      return items;
    }
    return items.filter((it) => (it.name || '').toLowerCase().includes(t));
  }, [items, q]);
  return (
    <div className="min-w-0 flex-[2] space-y-2">
      <Input
        className="h-8 text-sm"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded border border-border bg-background p-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga träffar</p>
        ) : (
          filtered.map((it) => {
            const id = Number(it.id);
            if (!Number.isFinite(id)) {
              return null;
            }
            return (
              <div key={it.id} className="flex items-center gap-2">
                <Checkbox
                  id={`m-${it.id}`}
                  checked={set.has(id)}
                  onCheckedChange={(c) => {
                    if (c) {
                      onChange([...valueIds, id].filter((x, i, a) => a.indexOf(x) === i));
                    } else {
                      onChange(valueIds.filter((x) => x !== id));
                    }
                  }}
                />
                <label htmlFor={`m-${it.id}`} className="text-sm leading-tight">
                  {it.name}
                </label>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterRowEditor(props: RowEditorProps) {
  const {
    row,
    onChange,
    onRemove,
    meta,
    channelInstances,
    lists,
    brands,
    suppliers,
    manufacturers,
  } = props;
  const typeMeta = useMemo(
    () => meta.filterTypes.find((t) => t.type === row.type),
    [meta.filterTypes, row.type],
  );
  const ops = typeMeta?.operators ?? [row.op];
  const lookup =
    row.type === 'brand'
      ? brands
      : row.type === 'supplier'
        ? suppliers
        : row.type === 'manufacturer'
          ? manufacturers
          : [];

  const onTypeChange = (t: string) => {
    const firstI = channelInstances[0] ? Number(channelInstances[0].id) : null;
    onChange(
      defaultFilterRule(
        t,
        firstI && Number.isFinite(firstI) && firstI > 0 ? firstI : null,
        firstI && Number.isFinite(firstI) && firstI > 0 ? firstI : null,
      ),
    );
  };

  const onOpChange = (op: string) => {
    const base = { ...row, op };
    if (row.type === 'brand' && op === 'in') {
      onChange({ ...base, op, value: [] });
    } else if (row.type === 'brand' && op === 'eq') {
      onChange({ ...base, op, value: 0 });
    } else if (row.type === 'supplier' && op === 'in') {
      onChange({ ...base, op, value: [] });
    } else if (row.type === 'supplier' && op === 'eq') {
      onChange({ ...base, op, value: 0 });
    } else if (row.type === 'manufacturer' && op === 'in') {
      onChange({ ...base, op, value: [] });
    } else if (row.type === 'manufacturer' && op === 'eq') {
      onChange({ ...base, op, value: 0 });
    } else {
      onChange(base as ProductCatalogFilterRow);
    }
  };

  if (row.type === 'channelPrice') {
    const v = (
      row.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}
    ) as {
      instanceId?: number;
      n?: number;
    };
    const iid = v.instanceId ?? 0;
    const num = v.n ?? 0;
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[8rem] flex-1">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {ops.length > 1 ? (
          <div className="min-w-[5rem]">
            <Label className="text-xs">Villkor</Label>
            <Select value={row.op} onValueChange={(o) => onChange({ ...row, op: o })}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ops.map((op) => (
                  <SelectItem key={op} value={op}>
                    {OP_LABEL[op] || op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="min-w-[12rem] flex-1">
          <Label className="text-xs">Kanal / butik</Label>
          <NativeSelect
            className="h-9 w-full"
            value={iid > 0 ? String(iid) : ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...row, op: row.op, value: { instanceId: n, n: num } });
            }}
          >
            <option value="">Välj instans</option>
            {channelInstances.map((c) => (
              <option key={c.id} value={c.id}>
                {formatChannelInstanceLabel(c).slice(0, 100)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-[6rem]">
          <Label className="text-xs">Pris</Label>
          <Input
            className="h-9 text-sm"
            type="number"
            min={0}
            step="any"
            value={num}
            onFocus={(e) => selectIfZero(e, num)}
            onChange={(e) => {
              const raw = e.target.value;
              const n = raw === '' ? 0 : Number.parseFloat(raw);
              onChange({
                ...row,
                op: row.op,
                value: { instanceId: iid, n: Number.isFinite(n) ? n : 0 },
              });
            }}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (row.type === 'status' && row.op === 'in') {
    const arr = Array.isArray(row.value) ? (row.value as string[]) : [];
    const forSale = arr.includes('for sale');
    const paused = arr.includes('paused');
    const toggle = (s: 'for sale' | 'paused', checked: boolean) => {
      const sset = new Set(arr);
      if (checked) {
        sset.add(s);
      } else {
        sset.delete(s);
      }
      onChange({ ...row, value: Array.from(sset) });
    };
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[8rem] flex-1">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 pb-0.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${row.id}-fs`}
              checked={forSale}
              onCheckedChange={(c) => toggle('for sale', Boolean(c))}
            />
            <label htmlFor={`${row.id}-fs`} className="text-sm">
              Till salu
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${row.id}-p`}
              checked={paused}
              onCheckedChange={(c) => toggle('paused', Boolean(c))}
            />
            <label htmlFor={`${row.id}-p`} className="text-sm">
              Pausad
            </label>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (row.type === 'condition' && row.op === 'in') {
    const arr = Array.isArray(row.value) ? (row.value as string[]) : [];
    const flags = {
      new: arr.includes('new'),
      used: arr.includes('used'),
      refurb: arr.includes('refurb'),
    };
    const toggle = (k: 'new' | 'used' | 'refurb', checked: boolean) => {
      const sset = new Set<string>(arr);
      if (checked) {
        sset.add(k);
      } else {
        sset.delete(k);
      }
      onChange({ ...row, value: Array.from(sset) });
    };
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[8rem] flex-1">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 pb-0.5">
          {(['new', 'used', 'refurb'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <Checkbox
                id={`${row.id}-c-${k}`}
                checked={flags[k]}
                onCheckedChange={(c) => toggle(k, Boolean(c))}
              />
              <label htmlFor={`${row.id}-c-${k}`} className="text-sm">
                {k === 'new' ? 'Ny' : k === 'used' ? 'Begagnad' : 'Renoverad'}
              </label>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (row.type === 'list' && row.op === 'eq' && row.value && typeof row.value === 'object') {
    const v = row.value as { mode?: string; listId?: number };
    const listMode = v.mode || 'all';
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[8rem] flex-1">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label className="text-xs">Lista</Label>
          <NativeSelect
            className="h-9 w-full"
            value={listMode === 'listId' ? `list:${v.listId ?? ''}` : listMode}
            onChange={(e) => {
              const s = e.target.value;
              if (s === 'all' || s === 'main') {
                onChange({ ...row, op: 'eq', value: { mode: s } });
              } else if (s.startsWith('list:')) {
                onChange({
                  ...row,
                  op: 'eq',
                  value: { mode: 'listId', listId: Number(s.slice(5)) },
                });
              }
            }}
          >
            <option value="all">Alla produkter</option>
            <option value="main">Huvudlista</option>
            {lists.map((l) => (
              <option key={l.id} value={`list:${l.id}`}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (
    row.type === 'channelState' &&
    row.op === 'eq' &&
    row.value &&
    typeof row.value === 'object'
  ) {
    const v = row.value as { instanceId?: number; state?: string };
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[8rem] flex-1">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[12rem] flex-[2]">
          <Label className="text-xs">Kanal / butik</Label>
          <NativeSelect
            className="h-9 w-full"
            value={v.instanceId && v.instanceId > 0 ? String(v.instanceId) : ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                ...row,
                op: 'eq',
                value: {
                  instanceId: n,
                  state: (v.state as (typeof CH_STATES)[number]['id']) || 'active',
                },
              });
            }}
          >
            <option value="">Välj instans</option>
            {channelInstances.map((c) => (
              <option key={c.id} value={c.id}>
                {formatChannelInstanceLabel(c).slice(0, 120)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-[10rem]">
          <Label className="text-xs">Läge</Label>
          <NativeSelect
            className="h-9 w-full"
            value={v.state || 'active'}
            onChange={(e) =>
              onChange({
                ...row,
                op: 'eq',
                value: {
                  instanceId: v.instanceId || 0,
                  state: e.target.value as (typeof v)['state'],
                },
              })
            }
          >
            {CH_STATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (row.type === 'brand' || row.type === 'supplier' || row.type === 'manufacturer') {
    const ids =
      row.op === 'in' && Array.isArray(row.value)
        ? (row.value as number[]).filter((n) => Number.isFinite(n) && n > 0)
        : [];
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
        <div className="min-w-[7rem] sm:max-w-[9rem]">
          <Label className="text-xs">Typ</Label>
          <Select value={row.type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.filterTypes.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[5rem] sm:max-w-[6rem]">
          <Label className="text-xs">Op</Label>
          <Select value={row.op} onValueChange={onOpChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['eq', 'in'].map((op) => (
                <SelectItem key={op} value={op}>
                  {op === 'eq' ? 'en' : 'flera'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {row.op === 'eq' ? (
          <div className="min-w-0 flex-[2]">
            <Label className="text-xs">Välj</Label>
            <NativeSelect
              className="h-9 w-full"
              value={typeof row.value === 'number' && row.value > 0 ? String(row.value) : ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...row, op: 'eq', value: n || 0 });
              }}
            >
              <option value="">Välj</option>
              {lookup.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <LookupMultiPicker
            items={lookup}
            valueIds={ids}
            onChange={(next) => onChange({ ...row, op: 'in', value: next })}
            placeholder="Sök…"
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Ta bort"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/20 p-2">
      <div className="min-w-[7rem] flex-1 sm:max-w-[9rem]">
        <Label className="text-xs">Typ</Label>
        <Select value={row.type} onValueChange={onTypeChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meta.filterTypes.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {ops.length > 1 ? (
        <div className="min-w-[5rem] flex-1 sm:max-w-[6rem]">
          <Label className="text-xs">Op</Label>
          <Select value={row.op} onValueChange={onOpChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ops.map((op) => (
                <SelectItem key={op} value={op}>
                  {OP_LABEL[op] || op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {row.type === 'quantity' && (
        <div className="min-w-[5rem] flex-1">
          <Label className="text-xs">Tal</Label>
          <Input
            className="h-9 text-sm"
            type="number"
            min={0}
            step="any"
            value={row.value as number}
            onFocus={(e) => selectIfZero(e, row.value as number)}
            onChange={(e) => {
              const raw = e.target.value;
              const n = raw === '' ? 0 : Number.parseFloat(raw);
              onChange({ ...row, value: Number.isFinite(n) ? n : 0 });
            }}
          />
        </div>
      )}
      {row.type === 'lagerplats' ? (
        <div className="min-w-0 flex-[2]">
          <Label className="text-xs">Text</Label>
          <Input
            className="h-9 text-sm"
            value={String(row.value ?? '')}
            onChange={(e) => onChange({ ...row, value: e.target.value })}
          />
        </div>
      ) : null}
      {row.type === 'sku' || row.type === 'ean' || row.type === 'gtin' ? (
        <div className="min-w-0 flex-[2]">
          <Label className="text-xs">Text</Label>
          <Input
            className="h-9 text-sm"
            value={String(row.value ?? '')}
            onChange={(e) => onChange({ ...row, value: e.target.value })}
          />
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={onRemove}
        aria-label="Ta bort"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type ProductCatalogFilterPanelProps = {
  isOpen: boolean;
  lists: Array<{ id: string; name: string }>;
  draftFilters: ProductCatalogFilterRow[];
  onChangeDraftFilters: (next: ProductCatalogFilterRow[]) => void;
  onApply: () => void;
  onClear: () => void;
  buildDefinition: () => ProductCatalogViewDefinition;
  onLoadDefinition: (d: ProductCatalogViewDefinition) => void;
  className?: string;
};

export function ProductCatalogFilterPanel(props: ProductCatalogFilterPanelProps) {
  const {
    isOpen,
    lists,
    draftFilters,
    onChangeDraftFilters,
    onApply,
    onClear,
    buildDefinition,
    onLoadDefinition,
    className,
  } = props;

  const [meta, setMeta] = useState<ProductFilterDefinitionsResponse | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<
    Array<{ id: string; name: string; definition: ProductCatalogViewDefinition }>
  >([]);
  const [brands, setBrands] = useState<LookupItem[]>([]);
  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [manufacturers, setManufacturers] = useState<LookupItem[]>([]);
  const [channelInstances, setChannelInstances] = useState<ChannelInstance[]>([]);
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const hasFetchedRef = useRef(false);

  const runBootstrap = useCallback(async () => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    setDataStatus('loading');
    try {
      const [def, savedR, b, s, m, ch] = await Promise.all([
        productsApi.getFilterDefinitions(),
        productsApi.listSavedProductFilters(),
        productsApi.getBrands(),
        productsApi.getSuppliers(),
        productsApi.getManufacturers(),
        /* Endast aktiverade instanser (samma som listInstances med enabled = true). */
        channelsApi.getInstances(),
      ]);
      setMeta(def);
      setSaved(
        Array.isArray((savedR as { items?: unknown })?.items)
          ? (savedR as { items: typeof saved }).items
          : [],
      );
      setBrands(
        (b || []).map((x) => ({
          id: String((x as { id: string }).id),
          name: (x as { name?: string }).name || '',
        })),
      );
      setSuppliers(
        (s || []).map((x) => ({
          id: String((x as { id: string }).id),
          name: (x as { name?: string }).name || '',
        })),
      );
      setManufacturers(
        (m || []).map((x) => ({
          id: String((x as { id: string }).id),
          name: (x as { name?: string }).name || '',
        })),
      );
      const raw = (ch as { items?: ChannelInstance[] } | null)?.items || [];
      const byId = new Map<string, ChannelInstance>();
      for (const it of raw) {
        const k = String(it.id);
        if (!byId.has(k)) {
          byId.set(k, it);
        }
      }
      setChannelInstances([...byId.values()]);
      setDataStatus('ready');
    } catch {
      hasFetchedRef.current = false;
      setDataStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void runBootstrap();
  }, [isOpen, runBootstrap]);

  const loadSavedOnly = useCallback(() => {
    void productsApi
      .listSavedProductFilters()
      .then((r) => {
        setSaved(
          Array.isArray((r as { items?: unknown })?.items)
            ? (r as { items: typeof saved }).items
            : [],
        );
      })
      .catch(() => {});
  }, []);

  const firstChId = useMemo(() => {
    const c = channelInstances[0];
    if (!c) {
      return null;
    }
    const n = Number(c.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [channelInstances]);

  const addRow = (type: string) => {
    onChangeDraftFilters([...draftFilters, defaultFilterRule(type, firstChId, firstChId)]);
  };

  const maxFilters = meta?.maxFilters ?? 20;
  const canAdd = draftFilters.length < maxFilters;
  const addableTypes = useMemo(() => (meta ? meta.filterTypes : []), [meta]);

  const onSave = async () => {
    setSaveErr(null);
    const n = saveName.trim();
    if (!n) {
      setSaveErr('Ange namn');
      return;
    }
    try {
      const def = buildDefinition();
      await productsApi.createSavedProductFilter({ name: n, definition: def });
      setSaveOpen(false);
      setSaveName('');
      loadSavedOnly();
    } catch (e: any) {
      setSaveErr(e?.message || e?.error || 'Kunde inte spara');
    }
  };

  if (!isOpen) {
    return null;
  }

  if (dataStatus === 'loading' || (dataStatus === 'idle' && !meta)) {
    return (
      <div
        className={cn('pt-2 text-sm text-muted-foreground', className)}
        role="status"
        aria-live="polite"
      >
        Laddar filter…
      </div>
    );
  }

  if (dataStatus === 'error' || !meta) {
    return (
      <div className={cn('pt-2', className)}>
        <p className="text-sm text-destructive">Kunde inte ladda filter. Försök igen.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => {
            hasFetchedRef.current = false;
            setDataStatus('idle');
            void runBootstrap();
          }}
        >
          Försök igen
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col border-t border-border', className)}>
      <div className="flex flex-col gap-2 pt-3">
        {draftFilters.map((row) => (
          <FilterRowEditor
            key={row.id}
            row={row}
            onChange={(next) =>
              onChangeDraftFilters(draftFilters.map((r) => (r.id === row.id ? next : r)))
            }
            onRemove={() => onChangeDraftFilters(draftFilters.filter((r) => r.id !== row.id))}
            meta={meta}
            channelInstances={channelInstances}
            lists={lists}
            brands={brands}
            suppliers={suppliers}
            manufacturers={manufacturers}
          />
        ))}
      </div>

      <div className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={!canAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Attribut
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-[20rem] overflow-y-auto">
            {addableTypes.map((t) => (
              <DropdownMenuItem
                key={t.type}
                onSelect={() => {
                  if (canAdd) {
                    addRow(t.type);
                  }
                }}
              >
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8">
                Sparade
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {saved.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">Inga sparade vyer</div>
              ) : (
                saved.map((s) => (
                  <DropdownMenuSub key={s.id}>
                    <DropdownMenuSubTrigger>{s.name}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onSelect={() => {
                          onLoadDefinition(s.definition);
                        }}
                      >
                        Ladda till utkast
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={async () => {
                          if (!window.confirm('Ta bort sparad vy?')) {
                            return;
                          }
                          await productsApi.deleteSavedProductFilter(s.id);
                          loadSavedOnly();
                        }}
                      >
                        Ta bort
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setSaveOpen(true)}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Spara vyn
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={onApply}>
            Uppdatera lista
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClear}>
            Rensa filter
          </Button>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spara filtervy</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="saved-filter-name">Namn</Label>
            <Input
              id="saved-filter-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="T.ex. CDON låg marginal"
            />
            {saveErr ? <p className="text-sm text-destructive">{saveErr}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSaveOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" onClick={onSave}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
