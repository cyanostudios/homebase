import {
  Mail,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Settings,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { exportItems } from '@/core/utils/exportUtils';
import { useOptionalActiveTimeTrackingContactId } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { contactExportConfig } from '../utils/contactExportConfig';
import {
  getInitialContactColumnCount,
  resolveContactColumnCount,
  CONTACTS_COLUMN_COUNT_STORAGE_KEY,
  CONTACTS_SETTINGS_KEY,
  type ContactColumnCount,
} from '../utils/contactColumnCount';
import {
  compareContactsTwoLevel,
  isContactAscDefaultField,
  type ContactSortField,
  type ContactSortOrder,
} from '../utils/contactListSort';

import { ContactListItem } from './ContactListItem';
import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = ContactSortField;
type SortOrder = ContactSortOrder;
type ContactFilter = 'all' | 'company' | 'private' | 'withTags' | 'timeLogged';

const COLUMN_OPTIONS: ContactColumnCount[] = [1, 2, 3];

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
  { value: 'tags', label: 'Tags' },
  { value: 'assignable', label: 'Assignable' },
  { value: 'time', label: 'Time' },
];

export const ContactList: React.FC = () => {
  const { t } = useTranslation();
  const {
    contacts,
    contactsContentView,
    openContactForView,
    openContactPanel,
    openContactSettings,
    closeContactSettingsView,
    deleteContacts,
    selectedContactIds,
    toggleContactSelected,
    mergeIntoContactSelection,
    selectAllContacts,
    clearContactSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedContactId,
    contactIdsWithTimeEntries,
  } = useContacts();
  const { getSettings, updateSettings, settingsVersion, user } = useApp();
  const activeTimeTrackingContactId = useOptionalActiveTimeTrackingContactId();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [secondarySort, setSecondarySort] = useState<SortField | ''>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<ContactColumnCount>(
    getInitialContactColumnCount,
  );
  const [activeFilter, setActiveFilter] = useState<ContactFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<ContactSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(CONTACTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveContactColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: ContactColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(CONTACTS_SETTINGS_KEY, { columnCount: count }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isContactAscDefaultField(field) ? 'asc' : 'desc');
    setSecondarySort((prev) => (prev === field ? '' : prev));
  };

  const handleSecondarySortChange = (value: string) => {
    if (value === '' || value === 'none') {
      setSecondarySort('');
      return;
    }
    const field = value as SortField;
    if (field === primarySort) {
      return;
    }
    setSecondarySort(field);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const secondarySortOptions = useMemo(
    () => SORT_FIELD_OPTIONS.filter((option) => option.value !== primarySort),
    [primarySort],
  );

  const primarySortOptions = useMemo(
    () =>
      secondarySort
        ? SORT_FIELD_OPTIONS.filter((option) => option.value !== secondarySort)
        : SORT_FIELD_OPTIONS,
    [secondarySort],
  );

  const sortedContacts = useMemo(() => {
    const timeCtx = {
      activeTimeTrackingContactId,
      contactIdsWithTimeEntries,
    };

    const comparePair = (a: Contact, b: Contact): number =>
      compareContactsTwoLevel(a, b, primarySort, secondarySort, sortOrder, timeCtx);

    const byFilter = contacts.filter((contact) => {
      if (activeFilter === 'company') {
        return contact.contactType === 'company';
      }
      if (activeFilter === 'private') {
        return contact.contactType === 'private';
      }
      if (activeFilter === 'withTags') {
        return Array.isArray(contact.tags) && contact.tags.length > 0;
      }
      if (activeFilter === 'timeLogged') {
        const idStr = String(contact.id);
        return contactIdsWithTimeEntries.has(contact.id) || contactIdsWithTimeEntries.has(idStr);
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return [...byFilter].sort(comparePair);
    }
    const filtered = byFilter.filter(
      (contact) =>
        contact.companyName.toLowerCase().includes(needle) ||
        contact.contactNumber.toLowerCase().includes(needle) ||
        contact.email.toLowerCase().includes(needle) ||
        (contact.organizationNumber && contact.organizationNumber.toLowerCase().includes(needle)) ||
        (contact.personalNumber && contact.personalNumber.toLowerCase().includes(needle)) ||
        (Array.isArray(contact.tags) &&
          contact.tags.some(
            (tag) => typeof tag === 'string' && tag.toLowerCase().includes(needle),
          )),
    );

    return [...filtered].sort(comparePair);
  }, [
    contacts,
    searchTerm,
    primarySort,
    secondarySort,
    sortOrder,
    activeFilter,
    activeTimeTrackingContactId,
    contactIdsWithTimeEntries,
  ]);

  const visibleContactIds = useMemo(
    () => sortedContacts.map((contact) => String(contact.id)),
    [sortedContacts],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleContactIds,
      mergeIntoSelection: mergeIntoContactSelection,
      toggleOne: toggleContactSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleContactIds.length > 0 && visibleContactIds.every((id) => isSelected(id)),
    [visibleContactIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleContactIds.some((id) => isSelected(id)),
    [visibleContactIds, isSelected],
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearContactSelection();
    } else {
      selectAllContacts(visibleContactIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContactIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteContacts(selectedContactIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedContactIds.length === 0) {
      alert('Please select contacts to export');
      return;
    }
    const selectedContacts = contacts.filter((contact) =>
      selectedContactIds.includes(String(contact.id)),
    );
    const filename = `contacts-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: selectedContacts,
      format: 'csv',
      config: contactExportConfig,
      filename,
      title: 'Contacts Export',
    });
  };

  const handleExportPDF = async () => {
    if (selectedContactIds.length === 0) {
      alert('Please select contacts to export');
      return;
    }
    const selectedContacts = contacts.filter((contact) =>
      selectedContactIds.includes(String(contact.id)),
    );
    const filename = `contacts-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selectedContacts,
      format: 'pdf',
      config: contactExportConfig,
      filename,
      title: 'Contacts Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err: unknown) => {
        console.error('PDF export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  };

  const handleOpenForView = (contact: any) => attemptNavigation(() => openContactForView(contact));

  const bulkMessageRecipients = useMemo(
    () =>
      contacts
        .filter((c) => selectedContactIds.includes(String(c.id)))
        .map((c) => ({
          id: String(c.id),
          name: c.companyName ?? '',
          phone: (c.phone && c.phone.trim()) || (c.phone2 && c.phone2.trim()) || '',
        })),
    [contacts, selectedContactIds],
  );

  const bulkEmailRecipients = useMemo(
    () =>
      contacts
        .filter((c) => selectedContactIds.includes(String(c.id)))
        .map((c) => ({
          id: String(c.id),
          name: c.companyName ?? '',
          email: c.email ? c.email.trim() : '',
        })),
    [contacts, selectedContactIds],
  );

  const stats = useMemo(() => {
    const hasTimeLogged = (c: Contact) => {
      const idStr = String(c.id);
      return contactIdsWithTimeEntries.has(c.id) || contactIdsWithTimeEntries.has(idStr);
    };
    return {
      total: contacts.length,
      companies: contacts.filter((c) => c.contactType === 'company').length,
      private: contacts.filter((c) => c.contactType === 'private').length,
      withTags: contacts.filter((c) => Array.isArray(c.tags) && c.tags.length > 0).length,
      timeLogged: contacts.filter(hasTimeLogged).length,
    };
  }, [contacts, contactIdsWithTimeEntries]);

  if (contactsContentView === 'settings') {
    return (
      <div className="plugin-contacts min-h-full bg-background">
        <div className="px-6 py-4">
          <ContactSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeContactSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-contacts min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.contacts')}</h2>
            <p className="text-sm text-muted-foreground">{t('contacts.description')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openContactSettings()}
              title={t('contacts.settings')}
            >
              {t('contacts.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openContactPanel(null))}
            >
              {t('contacts.addContact')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <ListFilterStatCard
            label={t('contacts.stats.total')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.companies')}
            value={stats.companies}
            dotClassName="bg-amber-500"
            active={activeFilter === 'company'}
            onClick={() => setActiveFilter('company')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.private')}
            value={stats.private}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'private'}
            onClick={() => setActiveFilter('private')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.withTags')}
            value={stats.withTags}
            dotClassName="bg-orange-500"
            active={activeFilter === 'withTags'}
            onClick={() => setActiveFilter('withTags')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.timeLogged')}
            value={stats.timeLogged}
            dotClassName="bg-amber-600"
            active={activeFilter === 'timeLogged'}
            onClick={() => setActiveFilter('timeLogged')}
          />
        </div>

        <BulkMessageDialog
          isOpen={showBulkMessageDialog}
          onClose={() => setShowBulkMessageDialog(false)}
          recipients={bulkMessageRecipients}
          pluginSource="contacts"
        />
        <BulkEmailDialog
          isOpen={showBulkEmailDialog}
          onClose={() => setShowBulkEmailDialog(false)}
          recipients={bulkEmailRecipients}
          pluginSource="contacts"
        />

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="contacts"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('contacts.searchPlaceholder', { count: contacts.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <div className="mr-1 flex items-center gap-1">
                <Select
                  value={primarySort}
                  onValueChange={(value) => handlePrimarySortChange(value as SortField)}
                >
                  <SelectTrigger
                    className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                    aria-label="Sort by"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="item-aligned"
                    className="rounded-xl border-border/50 shadow-xl"
                  >
                    {primarySortOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="rounded-md text-xs"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={secondarySort || 'none'} onValueChange={handleSecondarySortChange}>
                  <SelectTrigger
                    className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                    aria-label="And sort by"
                  >
                    <SelectValue placeholder="And..." />
                  </SelectTrigger>
                  <SelectContent
                    position="item-aligned"
                    className="rounded-xl border-border/50 shadow-xl"
                  >
                    <SelectItem value="none" className="rounded-md text-xs">
                      And...
                    </SelectItem>
                    {secondarySortOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="rounded-md text-xs"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 px-0 text-xs"
                  onClick={toggleSortOrder}
                  aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                {COLUMN_OPTIONS.map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                      columnCount === count
                        ? 'bg-background text-foreground shadow-sm hover:bg-background'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setColumnCount(count)}
                    aria-label={t(`contacts.columns${count}`)}
                    aria-pressed={columnCount === count}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {sortedContacts.length > 0 ? (
            <div className="flex min-h-[3.75rem] flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
              {selectedCount === 0 ? (
                <div className="flex h-9 min-w-0 items-center gap-2">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleHeaderCheckboxChange}
                    className="h-4 w-4 cursor-pointer"
                    aria-label="Select all contacts"
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={clearContactSelection}
                    type="button"
                  >
                    {t('common.clearSelection')}
                  </Button>
                  <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {t('bulk.selected', { count: selectedCount })}
                  </span>
                  {canSendMessages ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={MessageSquare}
                      onClick={() => setShowBulkMessageDialog(true)}
                      className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                    >
                      {t('bulk.sendMessageTitle')}
                    </Button>
                  ) : null}
                  {canSendEmail ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Mail}
                      onClick={() => setShowBulkEmailDialog(true)}
                      className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                    >
                      {t('bulk.sendEmailTitle')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={FileSpreadsheet}
                    onClick={handleExportCSV}
                    className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  >
                    {t('contacts.exportCsv')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={FileText}
                    onClick={handleExportPDF}
                    className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  >
                    {t('contacts.exportPdf')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  >
                    {t('contacts.delete')}
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {sortedContacts.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950">
              {searchTerm ? t('contacts.noMatch') : t('contacts.noYet')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {sortedContacts.map((contact, index) => {
                const contactIsSelected = isSelected(contact.id);
                const timeTrackingActiveHere =
                  activeTimeTrackingContactId !== null &&
                  String(contact.id) === activeTimeTrackingContactId;
                const hasTimeLogged =
                  contactIdsWithTimeEntries.has(contact.id) ||
                  contactIdsWithTimeEntries.has(String(contact.id));
                return (
                  <ContactListItem
                    key={contact.id}
                    contact={contact}
                    selected={contactIsSelected}
                    highlighted={recentlyDuplicatedContactId === String(contact.id)}
                    onClick={() => handleOpenForView(contact)}
                    hasTimeLogged={hasTimeLogged}
                    timeTrackingActive={timeTrackingActiveHere}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={contactIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                      />
                    }
                  />
                );
              })}
            </div>
          )}

          <div className="rounded-xl bg-white px-4 py-3 text-xs text-muted-foreground shadow-sm dark:bg-slate-950">
            Showing {sortedContacts.length} of {contacts.length} Contacts
          </div>
        </div>
      </div>
    </div>
  );
};
