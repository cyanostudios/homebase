import { Timer } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Contact } from '../types/contacts';
import { CONTACT_TYPE_BADGE_CLASS, CONTACT_TYPE_COLORS } from '../types/contacts';
import type { ContactSortField, ContactSortOrder } from '../utils/contactListSort';
import {
  DEFAULT_CONTACT_TABLE_COLUMNS,
  type ContactTableColumnId,
  resolveVisibleContactTableColumns,
} from '../utils/contactTableColumns';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

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
  /** When false, the selection checkbox column is hidden until bulk select mode is active. */
  selectionEnabled?: boolean;
  activeTimeTrackingContactId: string | null;
  contactIdsWithTimeEntries: ReadonlySet<string | number>;
  recentlyDuplicatedContactId: string | null;
  activeContactId?: string | number | null;
  /** Ordered visible table column ids from user settings. */
  visibleColumnIds?: ContactTableColumnId[];
};

function formatContactPhone(contact: Contact): string {
  const primary = contact.phone?.trim();
  if (primary) {
    return primary;
  }
  return contact.phone2?.trim() || '';
}

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
  selectionEnabled = true,
  activeTimeTrackingContactId,
  contactIdsWithTimeEntries,
  recentlyDuplicatedContactId,
  activeContactId = null,
  visibleColumnIds,
}: ContactListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleContactTableColumns({ tableColumns: DEFAULT_CONTACT_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<
      ContactTableColumnId,
      {
        field: ContactSortField;
        header: React.ReactNode;
        className?: string;
        cell: (contact: Contact) => React.ReactNode;
      }
    > = {
      name: {
        field: 'name',
        header: t('contacts.table.name'),
        cell: (contact: Contact) => (
          <span className="font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary">
            {contact.companyName}
          </span>
        ),
      },
      type: {
        field: 'type',
        header: t('contacts.table.type'),
        cell: (contact: Contact) => (
          <Badge
            className={cn(
              BADGE_CLASS,
              CONTACT_TYPE_BADGE_CLASS,
              CONTACT_TYPE_COLORS[contact.contactType],
            )}
          >
            {t(`contacts.type.${contact.contactType}`)}
          </Badge>
        ),
      },
      tags: {
        field: 'tags',
        header: t('contacts.table.tags'),
        className: 'hidden lg:table-cell',
        cell: (contact: Contact) => {
          const tags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
          if (tags.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
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
                <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
              ) : null}
            </div>
          );
        },
      },
      assignable: {
        field: 'assignable',
        header: t('contacts.table.assignable'),
        cell: (contact: Contact) => (
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              contact.isAssignable ? 'bg-emerald-500' : 'bg-red-500',
            )}
            title={contact.isAssignable ? t('contacts.assignableYes') : t('contacts.assignableNo')}
            aria-label={
              contact.isAssignable ? t('contacts.assignableYes') : t('contacts.assignableNo')
            }
          />
        ),
      },
      time: {
        field: 'time',
        header: t('contacts.table.time'),
        className: 'hidden md:table-cell',
        cell: (contact: Contact) => {
          const timeTrackingActive =
            activeTimeTrackingContactId !== null &&
            String(contact.id) === activeTimeTrackingContactId;
          const hasTimeLogged =
            contactIdsWithTimeEntries.has(contact.id) ||
            contactIdsWithTimeEntries.has(String(contact.id));

          if (timeTrackingActive) {
            return (
              <span
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                title={t('contacts.timeTrackingActive')}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t('contacts.timeTrackingActive')}</span>
              </span>
            );
          }
          if (hasTimeLogged) {
            return (
              <Badge
                variant="outline"
                className="inline-flex h-5 items-center gap-1 border-amber-200/60 bg-amber-50/60 px-1.5 text-[10px] font-extrabold text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Timer className="h-2.5 w-2.5" aria-hidden />
                {t('contacts.timeLoggedBadge')}
              </Badge>
            );
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
      },
      email: {
        field: 'email',
        header: t('contacts.table.email'),
        className: 'hidden md:table-cell',
        cell: (contact: Contact) => {
          const email = contact.email?.trim();
          return email ? (
            <span className="truncate text-sm text-muted-foreground">{email}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      phone: {
        field: 'phone',
        header: t('contacts.table.phone'),
        className: 'hidden md:table-cell',
        cell: (contact: Contact) => {
          const phone = formatContactPhone(contact);
          return phone ? (
            <span className="truncate text-sm text-muted-foreground">{phone}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      createdAt: {
        field: 'createdAt',
        header: t('contacts.table.created'),
        className: 'hidden lg:table-cell',
        cell: (contact: Contact) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(contact.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('contacts.table.updated'),
        className: 'hidden lg:table-cell',
        cell: (contact: Contact) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(contact.updatedAt) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t, activeTimeTrackingContactId, contactIdsWithTimeEntries]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is (typeof columnDefs)[ContactTableColumnId] => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={contacts}
      columns={columns}
      getRowId={(contact) => String(contact.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(contact) => t('contacts.openContact', { name: contact.companyName })}
      rowClassName={(contact) =>
        recentlyDuplicatedContactId === String(contact.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(contact) =>
        activeContactId != null && String(contact.id) === String(activeContactId)
      }
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('contacts.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('contacts.unselectContact') : t('contacts.selectContact'),
            }
          : undefined
      }
      pluginName="contacts"
      dataListItem={(contact) => contact}
    />
  );
}
