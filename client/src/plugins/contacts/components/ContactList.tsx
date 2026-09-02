import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Building2,
  Clock,
  LayoutGrid,
  Mail,
  MessageSquare,
  Trash2,
  FileSpreadsheet,
  FileText,
  Plus,
  Settings,
  Tag,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { exportItems } from '@/core/utils/exportUtils';
import { useOptionalActiveTimeTrackingContactId } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import {
  CONTACTS_COLUMN_COUNT_STORAGE_KEY,
  CONTACTS_SETTINGS_KEY,
  getInitialContactColumnCount,
  resolveContactColumnCount,
  type ContactColumnCount,
} from '../utils/contactColumnCount';
import { contactExportConfig } from '../utils/contactExportConfig';
import {
  contactMatchesListFilters,
  toggleContactListFilter,
  type ContactListFilter,
  type ContactListFilterSelection,
} from '../utils/contactListFilter';
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
import {
  resolveVisibleContactTableColumns,
  type ContactTableColumnId,
} from '../utils/contactTableColumns';

import { ContactBulkAssignableDialog } from './ContactBulkAssignableDialog';
import { ContactBulkTagsDialog } from './ContactBulkTagsDialog';
import { ContactListItem } from './ContactListItem';
import { ContactListTable } from './ContactListTable';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = ContactSortField;
type SortOrder = ContactSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'name', labelKey: 'contacts.table.name' },
  { value: 'type', labelKey: 'contacts.table.type' },
  { value: 'tags', labelKey: 'contacts.table.tags' },
  { value: 'assignable', labelKey: 'contacts.table.assignable' },
  { value: 'time', labelKey: 'contacts.table.time' },
  { value: 'updatedAt', labelKey: 'contacts.table.updated' },
  { value: 'createdAt', labelKey: 'common.created' },
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

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('contacts.searchPlaceholder', { count: contacts.length }),
  });

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
  const [visibleColumnIds, setVisibleColumnIds] = useState<ContactTableColumnId[]>(() =>
    resolveVisibleContactTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<ContactListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<ContactSettingsCategory>('tags');
  const [selectionMode, setSelectionMode] = useState(false);
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
        const tags = Array.isArray(settings?.tags)
          ? settings.tags.filter(
              (tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0,
            )
          : [];
        setAvailableTags(tags);
        const next = resolveContactColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveContactListViewMode(settings);
        setListViewModeState(nextView);
        persistContactListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleContactTableColumns(settings));
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

  const showQuickContext = Boolean(previewContact) && !isCompactViewport;
  const quickContextOpen = Boolean(showQuickContext && previewContact);
  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

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

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearContactSelection();
    setSelectionMode(false);
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
    if (selectionMode) {
      toggleContactSelected(String(contact.id));
      return;
    }
    setPreviewContact((current) =>
      current && String(current.id) === String(contact.id) ? null : contact,
    );
  };

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

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    const actions: BulkActionRoundItem[] = [
      {
        key: 'tags',
        label: t('contacts.bulkTagsAction'),
        icon: Tag,
        disabled,
        onClick: () => setShowBulkTagsDialog(true),
      },
      {
        key: 'assignable',
        label: t('contacts.bulkAssignableAction'),
        icon: UserCheck,
        disabled,
        onClick: () => setShowBulkAssignableDialog(true),
      },
    ];
    if (canSendMessages) {
      actions.push({
        key: 'message',
        label: t('bulk.message'),
        icon: MessageSquare,
        disabled,
        contentClassName: 'text-sky-500 dark:text-sky-400',
        onClick: () => setShowBulkMessageDialog(true),
      });
    }
    if (canSendEmail) {
      actions.push({
        key: 'email',
        label: t('bulk.email'),
        icon: Mail,
        disabled,
        contentClassName: 'text-red-800 dark:text-red-500',
        onClick: () => setShowBulkEmailDialog(true),
      });
    }
    actions.push(
      {
        key: 'csv',
        label: t('contacts.exportCsv'),
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: t('contacts.exportPdf'),
        icon: FileText,
        disabled,
        onClick: handleExportPDF,
      },
      {
        key: 'delete',
        label: t('contacts.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    );
    return actions;
  }, [selectedCount, canSendMessages, canSendEmail, t, handleExportCSV, handleExportPDF]);

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
    <div className={cn('plugin-contacts', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.contacts')}</h2>
                <ExpandableIconButton
                  icon={Settings}
                  label={t('contacts.settings')}
                  variant="soft"
                  onClick={() => openContactSettings()}
                />
                {sortedContacts.length > 0 ? (
                  selectionMode ? (
                    <ExpandableIconButton
                      icon={XCircle}
                      label={t('common.clear')}
                      variant="danger"
                      alwaysExpanded
                      onClick={handleExitSelectionMode}
                    />
                  ) : (
                    <ExpandableIconButton
                      icon={CheckSquare}
                      label={t('common.select')}
                      variant="soft"
                      alwaysExpanded
                      onClick={handleEnterSelectionMode}
                    />
                  )
                ) : null}
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('contacts.searchPlaceholder', { count: contacts.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`contacts.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('contacts.addContact')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openContactPanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                {t('contacts.stats.total')}{' '}
                <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('company')}
              className={cn(
                isFilterActive('company') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>
                {t('contacts.stats.companies')}{' '}
                <span className="tabular-nums font-semibold">({stats.companies})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('private')}
              className={cn(
                isFilterActive('private') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>
                {t('contacts.stats.private')}{' '}
                <span className="tabular-nums font-semibold">({stats.private})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('withTags')}
              className={cn(
                isFilterActive('withTags') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>
                {t('contacts.stats.withTags')}{' '}
                <span className="tabular-nums font-semibold">({stats.withTags})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('timeLogged')}
              className={cn(
                isFilterActive('timeLogged')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                {t('contacts.stats.timeLogged')}{' '}
                <span className="tabular-nums font-semibold">({stats.timeLogged})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
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
                    {t(option.labelKey)}
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

        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewContact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewContact ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
                <ContactQuickContextPanel
                  contact={previewContact}
                  availableTags={availableTags}
                  selectionMode={selectionMode}
                  onClose={() => setPreviewContact(null)}
                  onOpenFullProfile={() => handleOpenForView(previewContact)}
                  onEdit={() => {
                    pendingQuickContextContactId = String(previewContact.id);
                    attemptNavigation(() => openContactForEdit(previewContact));
                  }}
                />
              </aside>
            ) : null}
            <div className="flex min-w-0 flex-col gap-3">
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
                  selectionEnabled={selectionMode}
                  activeTimeTrackingContactId={activeTimeTrackingContactId}
                  contactIdsWithTimeEntries={contactIdsWithTimeEntries}
                  recentlyDuplicatedContactId={recentlyDuplicatedContactId}
                  activeContactId={previewContact?.id ?? null}
                  visibleColumnIds={visibleColumnIds}
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
                    const timeTrackingActive =
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
                        timeTrackingActive={timeTrackingActive}
                        columnCount={effectiveCardColumnCount}
                        checkbox={
                          selectionMode ? (
                            <input
                              type="checkbox"
                              checked={contactIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(contact.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                            />
                          ) : undefined
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
