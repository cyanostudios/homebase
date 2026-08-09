import { ArrowDown, ArrowUp, Timer } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { Contact } from '../types/contacts';
import { CONTACT_TYPE_BADGE_CLASS, CONTACT_TYPE_COLORS } from '../types/contacts';
import type { ContactSortField, ContactSortOrder } from '../utils/contactListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

const SORTABLE_COLUMNS: {
  field: ContactSortField;
  labelKey: string;
  className?: string;
}[] = [
  { field: 'name', labelKey: 'contacts.table.name' },
  { field: 'type', labelKey: 'contacts.table.type' },
  { field: 'email', labelKey: 'contacts.table.email', className: 'hidden sm:table-cell' },
  { field: 'phone', labelKey: 'contacts.table.phone', className: 'hidden md:table-cell' },
  { field: 'tags', labelKey: 'contacts.table.tags', className: 'hidden lg:table-cell' },
  { field: 'assignable', labelKey: 'contacts.table.assignable' },
  { field: 'time', labelKey: 'contacts.table.time', className: 'hidden md:table-cell' },
  { field: 'updatedAt', labelKey: 'contacts.table.updated', className: 'hidden lg:table-cell' },
];

export type ContactListTableProps = {
  contacts: Contact[];
  primarySort: ContactSortField;
  sortOrder: ContactSortOrder;
  onSort: (field: ContactSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (contact: Contact) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  activeTimeTrackingContactId: string | null;
  contactIdsWithTimeEntries: ReadonlySet<string | number>;
  recentlyDuplicatedContactId: string | null;
};

export function ContactListTable({
  contacts,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  activeTimeTrackingContactId,
  contactIdsWithTimeEntries,
  recentlyDuplicatedContactId,
}: ContactListTableProps) {
  const { t } = useTranslation();

  const sortIcon = (field: ContactSortField) =>
    primarySort === field ? (
      sortOrder === 'asc' ? (
        <ArrowUp className="inline h-3 w-3" aria-hidden />
      ) : (
        <ArrowDown className="inline h-3 w-3" aria-hidden />
      )
    ) : null;

  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
      <Table rowBorders={false}>
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onHeaderCheckboxChange}
                className="h-4 w-4 cursor-pointer"
                aria-label={t('contacts.selectAllVisible')}
              />
            </TableHead>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={cn(
                  'cursor-pointer select-none text-xs hover:bg-muted/50',
                  col.className,
                )}
                onClick={() => onSort(col.field)}
                aria-sort={
                  primarySort === col.field
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-2">
                  <span>{t(col.labelKey)}</span>
                  {sortIcon(col.field)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact, index) => {
            const selected = isSelected(String(contact.id));
            const tags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
            const phone = (contact.phone?.trim() || contact.phone2?.trim() || '').trim();
            const updatedLabel = contact.updatedAt
              ? new Date(contact.updatedAt).toLocaleDateString()
              : '—';
            const timeTrackingActive =
              activeTimeTrackingContactId !== null &&
              String(contact.id) === activeTimeTrackingContactId;
            const hasTimeLogged =
              contactIdsWithTimeEntries.has(contact.id) ||
              contactIdsWithTimeEntries.has(String(contact.id));
            const highlighted = recentlyDuplicatedContactId === String(contact.id);

            return (
              <TableRow
                key={contact.id}
                className={cn(
                  'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80',
                  selected && 'bg-plugin-subtle ring-1 border-plugin-subtle',
                  highlighted && 'bg-green-50 dark:bg-green-950/30',
                )}
                onClick={() => onRowClick(contact)}
                data-list-item={JSON.stringify(contact)}
                data-plugin-name="contacts"
                role="button"
                aria-label={t('contacts.openContact', { name: contact.companyName })}
              >
                <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onMouseDown={(e) => onCheckboxMouseDown(e, index)}
                    onChange={() => onCheckboxChange(String(contact.id))}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={
                      selected ? t('contacts.unselectContact') : t('contacts.selectContact')
                    }
                  />
                </TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">{contact.companyName}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      BADGE_CLASS,
                      CONTACT_TYPE_BADGE_CLASS,
                      CONTACT_TYPE_COLORS[contact.contactType],
                    )}
                  >
                    {t(`contacts.type.${contact.contactType}`)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                  <span className="truncate">{contact.email || '—'}</span>
                </TableCell>
                <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                  {phone || '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex max-w-[12rem] flex-wrap gap-1">
                      {tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="h-5 border-border/50 px-1.5 text-[10px] font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {tags.length > 2 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{tags.length - 2}
                        </span>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-block h-2 w-2 rounded-full',
                      contact.isAssignable ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                    title={
                      contact.isAssignable
                        ? t('contacts.assignableYes')
                        : t('contacts.assignableNo')
                    }
                    aria-label={
                      contact.isAssignable
                        ? t('contacts.assignableYes')
                        : t('contacts.assignableNo')
                    }
                  />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {timeTrackingActive ? (
                    <span
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                      title={t('contacts.timeTrackingActive')}
                    >
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">{t('contacts.timeTrackingActive')}</span>
                    </span>
                  ) : hasTimeLogged ? (
                    <Badge
                      variant="outline"
                      className="inline-flex h-5 items-center gap-1 border-amber-200/60 bg-amber-50/60 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Timer className="h-2.5 w-2.5" aria-hidden />
                      {t('contacts.timeLoggedBadge')}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                  {updatedLabel}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
