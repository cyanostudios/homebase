import {
  CheckSquare,
  Mail,
  MessageSquare,
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

import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
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
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';
import { contactExportConfig } from '../utils/contactExportConfig';
import {
  compareContactsByField,
  isContactAscDefaultField,
  type ContactSortField,
  type ContactSortOrder,
} from '../utils/contactListSort';

import { ContactBulkAssignableDialog } from './ContactBulkAssignableDialog';
import { ContactBulkTagsDialog } from './ContactBulkTagsDialog';
import { ContactListTable } from './ContactListTable';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = ContactSortField;
type SortOrder = ContactSortOrder;

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
  const { getSettings, settingsVersion, user } = useApp();
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

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
        label: t('bulk.sendMessageTitle'),
        icon: MessageSquare,
        disabled,
        contentClassName: 'text-sky-500 dark:text-sky-400',
        onClick: () => setShowBulkMessageDialog(true),
      });
    }
    if (canSendEmail) {
      actions.push({
        key: 'email',
        label: t('bulk.sendEmailTitle'),
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
              <ExpandableIconButton
                icon={Plus}
                label={t('contacts.addContact')}
                alwaysExpanded
                onClick={() => attemptNavigation(() => openContactPanel(null))}
              />
            </div>
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

        <div className="flex flex-col gap-3">
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
              ) : (
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
                />
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
