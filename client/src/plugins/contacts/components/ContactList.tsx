import {
  CheckSquare,
  Mail,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Plus,
  Settings,
  Tag,
  UserCheck,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { exportItems } from '@/core/utils/exportUtils';
import { useOptionalActiveTimeTrackingContactId } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import {
  contactMatchesListFilters,
  toggleContactListFilter,
  type ContactListFilter,
  type ContactListFilterSelection,
} from '../utils/contactListFilter';
import {
  getInitialContactColumnCount,
  resolveContactColumnCount,
  CONTACTS_COLUMN_COUNT_STORAGE_KEY,
  CONTACTS_SETTINGS_KEY,
  type ContactColumnCount,
} from '../utils/contactColumnCount';
import { contactExportConfig } from '../utils/contactExportConfig';
import {
  compareContactsByField,
  isContactAscDefaultField,
  type ContactSortField,
  type ContactSortOrder,
} from '../utils/contactListSort';
import {
  getInitialContactListViewMode,
  persistContactListViewModeSession,
  resolveContactListViewMode,
  type ContactListViewMode,
} from '../utils/contactListViewMode';

import { ContactBulkAssignableDialog } from './ContactBulkAssignableDialog';
import { ContactBulkTagsDialog } from './ContactBulkTagsDialog';
import { ContactListItem } from './ContactListItem';
import { ContactListTable } from './ContactListTable';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = ContactSortField;
type SortOrder = ContactSortOrder;

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

// Remembers which contact was open in the full-profile view (module-scoped since
// ContactList unmounts while the full profile panel is shown). Consumed once on the
// next mount so closing the full profile brings back the same contact's quick context.
let pendingQuickContextContactId: string | null = null;

export const ContactList: React.FC = () => {
  const { t } = useTranslation();
  const {
    contacts,
    contactsContentView,
    openContactForView,
    openContactPanel,
    openContactForEdit,
    openContactSettings,
    closeContactSettingsView,
    deleteContacts,
    applyTagToContact,
    clearTagsFromContact,
    setContactAssignable,
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

  useMobileActions({
    onAdd: () => attemptNavigation(() => openContactPanel(null)),
    onSettings: () => openContactSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [showBulkTagsDialog, setShowBulkTagsDialog] = useState(false);
  const [showBulkAssignableDialog, setShowBulkAssignableDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<ContactColumnCount>(
    getInitialContactColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<ContactListViewMode>(
    getInitialContactListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<ContactListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<ContactSettingsCategory>('view');
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const restoredPendingContactRef = useRef(false);

  useEffect(() => {
    if (restoredPendingContactRef.current || !pendingQuickContextContactId) {
      return;
    }
    const restored = contacts.find(
      (contact) => String(contact.id) === pendingQuickContextContactId,
    );
    if (restored) {
      setPreviewContact(restored);
      restoredPendingContactRef.current = true;
      pendingQuickContextContactId = null;
    }
  }, [contacts]);

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
        const nextView = resolveContactListViewMode(settings);
        setListViewModeState(nextView);
        persistContactListViewModeSession(nextView);
        const tags = Array.isArray(settings?.tags)
          ? settings.tags.filter(
              (tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0,
            )
          : [];
        setAvailableTags(tags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: ContactColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistContactListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(CONTACTS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: ContactListViewMode) => {
      setListViewModeState(mode);
      persistContactListViewModeSession(mode);
      updateSettings(CONTACTS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isContactAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isContactAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const sortedContacts = useMemo(() => {
    const timeCtx = {
      activeTimeTrackingContactId,
      contactIdsWithTimeEntries,
    };

    const comparePair = (a: Contact, b: Contact): number =>
      compareContactsByField(a, b, primarySort, sortOrder, timeCtx);

    const byFilter = contacts.filter((contact) =>
      contactMatchesListFilters(contact, activeFilters, contactIdsWithTimeEntries),
    );

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
    sortOrder,
    activeFilters,
    activeTimeTrackingContactId,
    contactIdsWithTimeEntries,
  ]);

  useEffect(() => {
    if (!previewContact) {
      return;
    }
    const next = contacts.find((contact) => String(contact.id) === String(previewContact.id));
    if (!next) {
      setPreviewContact(null);
      return;
    }
    if (next !== previewContact) {
      setPreviewContact(next);
    }
  }, [contacts, previewContact]);

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

  const handleOpenForView = (contact: Contact) => {
    // Remember the contact so closing the full profile restores its quick context card.
    pendingQuickContextContactId = String(contact.id);
    attemptNavigation(() => openContactForView(contact));
  };

  const handleRowActivate = (contact: Contact) => {
    if (isCompactViewport) {
      handleOpenForView(contact);
      return;
    }
    setPreviewContact(contact);
  };

  const showQuickContext = Boolean(previewContact) && !isCompactViewport;

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

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedContactIds.includes(String(contact.id))),
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

  const isFilterActive = (filter: ContactListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: ContactListFilter) => {
    setActiveFilters((prev) => toggleContactListFilter(prev, filter));
  };

  if (contactsContentView === 'settings') {
    return (
      <div className="plugin-contacts min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <ContactSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeContactSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-contacts min-h-full overflow-x-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.contacts')}</h2>
            <p className="text-sm text-muted-foreground">{t('contacts.description')}</p>
          </div>
          <div className="flex w-full flex-shrink-0 items-center gap-2 md:w-auto md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={() => openContactSettings()}
              title={t('contacts.settings')}
            >
              {t('contacts.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openContactPanel(null))}
            >
              {t('contacts.addContact')}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            LIST_FILTER_STAT_ROW_CLASS,
            'md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-5',
          )}
        >
          <ListFilterStatCard
            label={t('contacts.stats.total')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('contacts.stats.companies')}
            value={stats.companies}
            dotClassName="bg-amber-500"
            active={isFilterActive('company')}
            onClick={() => toggleFilter('company')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.private')}
            value={stats.private}
            dotClassName="bg-emerald-500"
            active={isFilterActive('private')}
            onClick={() => toggleFilter('private')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.withTags')}
            value={stats.withTags}
            dotClassName="bg-orange-500"
            active={isFilterActive('withTags')}
            onClick={() => toggleFilter('withTags')}
          />
          <ListFilterStatCard
            label={t('contacts.stats.timeLogged')}
            value={stats.timeLogged}
            dotClassName="bg-amber-600"
            active={isFilterActive('timeLogged')}
            onClick={() => toggleFilter('timeLogged')}
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

        <ContactBulkTagsDialog
          isOpen={showBulkTagsDialog}
          onClose={() => setShowBulkTagsDialog(false)}
          selectedContacts={selectedContacts}
          availableTags={availableTags}
          applyTagToContact={applyTagToContact}
          clearTagsFromContact={clearTagsFromContact}
          onSuccess={clearContactSelection}
        />

        <ContactBulkAssignableDialog
          isOpen={showBulkAssignableDialog}
          onClose={() => setShowBulkAssignableDialog(false)}
          selectedContacts={selectedContacts}
          setContactAssignable={setContactAssignable}
          onSuccess={clearContactSelection}
        />

        <div className="flex flex-col gap-0 md:gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedContacts.length > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={handleHeaderCheckboxChange}
              >
                Select all
              </Button>
            }
            search={
              <ListSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('contacts.searchPlaceholder', { count: contacts.length })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
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
                        {SORT_FIELD_OPTIONS.map((option) => (
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
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => t(`contacts.columns${count}`)}
                  tableAriaLabel={t('common.tableView')}
                />
              </>
            }
            bulkActions={
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
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Tag}
                  onClick={() => setShowBulkTagsDialog(true)}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('contacts.bulkTagsAction')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={UserCheck}
                  onClick={() => setShowBulkAssignableDialog(true)}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('contacts.bulkAssignableAction')}
                </Button>
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
            }
          />

          <div className="flex items-start gap-4">
            {showQuickContext && previewContact ? (
              <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
                <ContactQuickContextPanel
                  contact={previewContact}
                  availableTags={availableTags}
                  onClose={() => setPreviewContact(null)}
                  onOpenFullProfile={() => handleOpenForView(previewContact)}
                  onEdit={() => {
                    pendingQuickContextContactId = String(previewContact.id);
                    attemptNavigation(() => openContactForEdit(previewContact));
                  }}
                />
              </aside>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {sortedContacts.length === 0 ? (
                <ListEmptyState
                  message={searchTerm ? t('contacts.noMatch') : t('contacts.noYet')}
                  createLabel={!searchTerm ? t('contacts.addContact') : undefined}
                  onCreate={
                    !searchTerm ? () => attemptNavigation(() => openContactPanel(null)) : undefined
                  }
                />
              ) : isTableView ? (
                <ContactListTable
                  contacts={sortedContacts}
                  primarySort={primarySort}
                  sortOrder={sortOrder}
                  onSort={handleTableSort}
                  isSelected={isSelected}
                  onRowClick={handleRowActivate}
                  onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                  onCheckboxChange={onVisibleRowCheckboxChange}
                  allVisibleSelected={allVisibleSelected}
                  onHeaderCheckboxChange={handleHeaderCheckboxChange}
                  selectionEnabled
                  activeTimeTrackingContactId={activeTimeTrackingContactId}
                  contactIdsWithTimeEntries={contactIdsWithTimeEntries}
                  recentlyDuplicatedContactId={recentlyDuplicatedContactId}
                  activeContactId={previewContact?.id ?? null}
                />
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    effectiveColumnCount === 1 && 'grid-cols-1',
                    effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                    effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
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
                        active={
                          previewContact != null && String(previewContact.id) === String(contact.id)
                        }
                        onClick={() => handleRowActivate(contact)}
                        hasTimeLogged={hasTimeLogged}
                        timeTrackingActive={timeTrackingActiveHere}
                        columnCount={effectiveCardColumnCount}
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

              <ListFooterBar
                meta={
                  <>
                    Showing {sortedContacts.length} of {contacts.length} Contacts
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
