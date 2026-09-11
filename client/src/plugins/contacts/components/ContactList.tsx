import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  Clock,
  LayoutGrid,
  Mail,
  Menu,
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
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useRegisterBrowseOrder } from '@/core/hooks/useRegisterBrowseOrder';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { exportItems } from '@/core/utils/exportUtils';
import { useOptionalActiveTimeTrackingContactId } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';
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
  resolveVisibleContactTableColumns,
  type ContactTableColumnId,
} from '../utils/contactTableColumns';

import { ContactBulkAssignableDialog } from './ContactBulkAssignableDialog';
import { ContactBulkTagsDialog } from './ContactBulkTagsDialog';
import { ContactForm } from './ContactForm';
import { ContactListTable } from './ContactListTable';
import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';
import { ContactsStatisticsView } from './ContactsStatisticsView';
import { ContactView } from './ContactView';

type SortField = ContactSortField;
type SortOrder = ContactSortOrder;

const CONTACTS_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.contacts.toolbar.collapsed';

function readContactsToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(CONTACTS_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeContactsToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CONTACTS_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

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
    setBrowseOrderIds,
    isContactPanelOpen,
    panelMode,
    currentContact,
    saveContact,
    closeContactPanel,
    validationErrors,
  } = useContacts();
  const { getSettings, settingsVersion, user } = useApp();
  const activeTimeTrackingContactId = useOptionalActiveTimeTrackingContactId();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openContactPanel(null)),
    onSettings: () => openContactSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const { searchTerm, setSearchTerm } = usePersistedListSearch('contacts');

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
  const [visibleColumnIds, setVisibleColumnIds] = useState<ContactTableColumnId[]>(() =>
    resolveVisibleContactTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<ContactListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<ContactSettingsCategory>('tags');
  const [selectionMode, setSelectionMode] = useState(false);
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readContactsToolbarCollapsed);
  const restoredPendingContactRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isContactPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isContactPanelOpen && panelMode === 'view' && currentContact != null;
  const detailContact = inlinePanelView ? currentContact : previewContact;
  const activeListContactId =
    (inlineForm || inlinePanelView) && currentContact != null
      ? currentContact.id
      : (previewContact?.id ?? null);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeContactsToolbarCollapsed(next);
      return next;
    });
  }, []);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

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
        setVisibleColumnIds(resolveVisibleContactTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isContactAscDefaultField(field) ? 'asc' : 'desc');
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

  // Keep preview in sync when opening edit/view from the detail column actions.
  useEffect(() => {
    if (!showDesktopSplit || !isContactPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentContact) {
      setPreviewContact(currentContact);
    }
  }, [showDesktopSplit, isContactPanelOpen, panelMode, currentContact]);

  const visibleContactIds = useMemo(
    () => sortedContacts.map((contact) => String(contact.id)),
    [sortedContacts],
  );

  useRegisterBrowseOrder(setBrowseOrderIds, visibleContactIds);

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
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = useCallback(() => {
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
  }, [contacts, selectedContactIds]);

  const handleExportPDF = useCallback(async () => {
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
  }, [contacts, selectedContactIds]);

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
    if (
      isContactPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeContactPanel();
        setPreviewContact(contact);
      });
      return;
    }
    setPreviewContact((current) =>
      current && String(current.id) === String(contact.id) ? null : contact,
    );
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeContactPanel();
  }, [closeContactPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: any) => {
      const ok = await saveContact(data);
      return ok;
    },
    [saveContact],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('contacts.stats.total'),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'company',
        active: isFilterActive('company'),
        icon: Building2,
        label: t('contacts.stats.companies'),
        count: stats.companies,
        onClick: () => toggleFilter('company'),
      },
      {
        key: 'private',
        active: isFilterActive('private'),
        icon: User,
        label: t('contacts.stats.private'),
        count: stats.private,
        onClick: () => toggleFilter('private'),
      },
      {
        key: 'withTags',
        active: isFilterActive('withTags'),
        icon: Tag,
        label: t('contacts.stats.withTags'),
        count: stats.withTags,
        onClick: () => toggleFilter('withTags'),
      },
      {
        key: 'timeLogged',
        active: isFilterActive('timeLogged'),
        icon: Clock,
        label: t('contacts.stats.timeLogged'),
        count: stats.timeLogged,
        onClick: () => toggleFilter('timeLogged'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('contacts.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('contacts.sort')}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc' ? t('contacts.sortAsc') : t('contacts.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('contacts.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('contacts.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedContacts.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
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

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={
                  toolbarCollapsed ? t('contacts.expandToolbar') : t('contacts.collapseToolbar')
                }
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="contacts-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-contacts flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="contacts-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.contacts')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('contacts.settings')}
                      variant="soft"
                      onClick={() => openContactSettings()}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('contacts.searchPlaceholder', { count: contacts.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('contacts.addContact')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openContactPanel(null))}
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    LIST_FILTER_AND_SORT_ROW_CLASS,
                    'pt-2',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  {renderFilterChips()}
                </div>
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {renderFilterChips()}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

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

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {sortedContacts.length === 0 ? (
                  <ListEmptyState
                    message={searchTerm ? t('contacts.noMatch') : t('contacts.noYet')}
                    createLabel={!searchTerm ? t('contacts.addContact') : undefined}
                    onCreate={
                      !searchTerm
                        ? () => attemptNavigation(() => openContactPanel(null))
                        : undefined
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
                    activeContactId={activeListContactId}
                    visibleColumnIds={visibleColumnIds}
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('contacts.quickContext.title')}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <ContactForm
                      ref={inlineFormRef}
                      currentContact={currentContact}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeContactPanel}
                      stacked
                    />
                  </div>
                ) : detailContact ? (
                  <ContactView contact={detailContact} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <ContactsStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
