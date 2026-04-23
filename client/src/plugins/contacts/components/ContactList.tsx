import {
  Mail,
  MessageSquare,
  Phone,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Plus,
  Search,
  Settings,
  Store,
  X,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { contactExportConfig } from '../utils/contactExportConfig';

import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';
type ContactFilter = 'all' | 'company' | 'private' | 'withTags';
const CONTACTS_VIEW_MODE_STORAGE_KEY = 'contacts:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(CONTACTS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

const CONTACTS_SETTINGS_KEY = 'contacts';
const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

function ContactAvatar({ contact }: { contact: Contact }) {
  const initials = contact.companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (contact.contactType === 'company') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <Store className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-[10px] font-semibold tracking-[0.08em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      {initials || 'NA'}
    </span>
  );
}

function TypeBadge({ type }: { type: 'company' | 'private' }) {
  return (
    <Badge
      className={cn(
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
        type === 'company'
          ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
          : 'bg-green-50/50 text-green-700 dark:text-green-300 dark:bg-green-950/30',
      )}
    >
      {type === 'company' ? 'Company' : 'Private'}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

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
  } = useContacts();
  const { getSettings, updateSettings, settingsVersion, user } = useApp();
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
  const [isMobile, setIsMobile] = useState(false);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [activeFilter, setActiveFilter] = useState<ContactFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<ContactSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(CONTACTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewModeState(nextMode);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CONTACTS_VIEW_MODE_STORAGE_KEY, nextMode);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CONTACTS_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(CONTACTS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedContacts = useMemo(() => {
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
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return [...byFilter].sort((a, b) => {
        let aValue: string;
        let bValue: string;
        if (sortField === 'name') {
          aValue = a.companyName.toLowerCase();
          bValue = b.companyName.toLowerCase();
        } else if (sortField === 'type') {
          aValue = a.contactType;
          bValue = b.contactType;
        } else {
          aValue = a.email?.toLowerCase() ?? '';
          bValue = b.email?.toLowerCase() ?? '';
        }
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
    }
    const filtered = byFilter.filter(
      (contact) =>
        contact.companyName.toLowerCase().includes(needle) ||
        contact.contactNumber.toLowerCase().includes(needle) ||
        contact.email.toLowerCase().includes(needle) ||
        (contact.organizationNumber && contact.organizationNumber.toLowerCase().includes(needle)) ||
        (contact.personalNumber && contact.personalNumber.toLowerCase().includes(needle)) ||
        (Array.isArray(contact.tags) &&
          contact.tags.some((t) => typeof t === 'string' && t.toLowerCase().includes(needle))),
    );

    return [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortField === 'name') {
        aValue = a.companyName.toLowerCase();
        bValue = b.companyName.toLowerCase();
      } else if (sortField === 'type') {
        aValue = a.contactType;
        bValue = b.contactType;
      } else {
        aValue = a.email?.toLowerCase() ?? '';
        bValue = b.email?.toLowerCase() ?? '';
      }

      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [contacts, searchTerm, sortField, sortOrder, activeFilter]);

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

  const stats = useMemo(
    () => ({
      total: contacts.length,
      companies: contacts.filter((c) => c.contactType === 'company').length,
      private: contacts.filter((c) => c.contactType === 'private').length,
      withTags: contacts.filter((c) => Array.isArray(c.tags) && c.tags.length > 0).length,
    }),
    [contacts],
  );

  // Full-page settings view (like Core Settings) instead of list
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label={t('contacts.stats.total')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label={t('contacts.stats.companies')}
            value={stats.companies}
            dotClassName="bg-amber-500"
            active={activeFilter === 'company'}
            onClick={() => setActiveFilter('company')}
          />
          <StatCard
            label={t('contacts.stats.private')}
            value={stats.private}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'private'}
            onClick={() => setActiveFilter('private')}
          />
          <StatCard
            label={t('contacts.stats.withTags')}
            value={stats.withTags}
            dotClassName="bg-orange-500"
            active={activeFilter === 'withTags'}
            onClick={() => setActiveFilter('withTags')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearContactSelection}
            actions={[
              ...(canSendMessages
                ? [
                    {
                      label: t('bulk.sendMessageTitle'),
                      icon: MessageSquare,
                      onClick: () => setShowBulkMessageDialog(true),
                    },
                  ]
                : []),
              ...(canSendEmail
                ? [
                    {
                      label: t('bulk.sendEmailTitle'),
                      icon: Mail,
                      onClick: () => setShowBulkEmailDialog(true),
                    },
                  ]
                : []),
              {
                label: t('contacts.exportCsv'),
                icon: FileSpreadsheet,
                onClick: handleExportCSV,
                variant: 'default',
              },
              {
                label: t('contacts.exportPdf'),
                icon: FileText,
                onClick: handleExportPDF,
                variant: 'default',
              },
              {
                label: t('contacts.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

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

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
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
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openContactSettings()}
                title={t('contacts.settings')}
              >
                {t('contacts.settings')}
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('contacts.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ListIcon}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('contacts.list')}
                </Button>
              </div>
            </div>
          </div>

          {sortedContacts.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('contacts.noMatch') : t('contacts.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedContacts.map((contact, index) => {
                const contactIsSelected = isSelected(contact.id);
                return (
                  <Card
                    key={contact.id}
                    className={cn(
                      'relative flex h-full min-h-[160px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-card p-5 shadow-sm transition-all',
                      contactIsSelected
                        ? 'plugin-contacts bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                        : 'hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md',
                      recentlyDuplicatedContactId === String(contact.id) && HIGHLIGHT_CLASS,
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenForView(contact);
                    }}
                    data-list-item={JSON.stringify(contact)}
                    data-plugin-name="contacts"
                    role="button"
                    aria-label={`Open contact ${contact.companyName}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={contactIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                      />
                      <div className="flex items-center gap-2">
                        <ContactAvatar contact={contact} />
                        <TypeBadge type={contact.contactType} />
                      </div>
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {contact.companyName}
                    </h3>
                    {(contact.organizationNumber || contact.personalNumber) && (
                      <div className="text-xs text-muted-foreground leading-snug">
                        {contact.contactType === 'company' && contact.organizationNumber && (
                          <span>Org: {contact.organizationNumber}</span>
                        )}
                        {contact.contactType === 'private' && contact.personalNumber && (
                          <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                        )}
                      </div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] text-muted-foreground leading-snug">
                      <div className="font-mono">{formatDisplayNumber('contacts', contact.id)}</div>
                      <div>Updated: {new Date(contact.updatedAt).toLocaleDateString()}</div>
                      <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : isMobile ? (
            <Card className="shadow-none">
              <div className="space-y-2 p-4">
                {sortedContacts.map((contact, index) => {
                  const contactIsSelected = isSelected(contact.id);
                  return (
                    <Card
                      key={contact.id}
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        e.preventDefault();
                        handleOpenForView(contact);
                      }}
                      data-list-item={JSON.stringify(contact)}
                      data-plugin-name="contacts"
                      role="button"
                      aria-label={`Open contact ${contact.companyName}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={contactIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(contact.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                              aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                            />
                            <ContactAvatar contact={contact} />
                            <TypeBadge type={contact.contactType} />
                          </div>
                          <h3 className="font-semibold text-base mb-1 truncate">
                            {contact.companyName}
                          </h3>
                          {contact.contactType === 'company' && contact.organizationNumber && (
                            <p className="text-xs text-muted-foreground mb-1">
                              Org: {contact.organizationNumber}
                            </p>
                          )}
                          {contact.contactType === 'private' && contact.personalNumber && (
                            <p className="text-xs text-muted-foreground mb-1">
                              PN: {contact.personalNumber.substring(0, 9)}XXXX
                            </p>
                          )}
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleHeaderCheckboxChange}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          allVisibleSelected ? 'Deselect all contacts' : 'Select all contacts'
                        }
                      />
                    </TableHead>
                    <TableHead className="w-12 text-xs" />
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Name</span>
                        {sortField === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Type</span>
                        {sortField === 'type' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Tags</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Email</span>
                        {sortField === 'email' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedContacts.map((contact, index) => {
                    const contactIsSelected = isSelected(contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          recentlyDuplicatedContactId === String(contact.id) && HIGHLIGHT_CLASS,
                        )}
                        tabIndex={0}
                        data-list-item={JSON.stringify(contact)}
                        data-plugin-name="contacts"
                        role="button"
                        aria-label={`Open contact ${contact.companyName}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return;
                          }
                          e.preventDefault();
                          handleOpenForView(contact);
                        }}
                      >
                        <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={contactIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(contact.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                          />
                        </TableCell>
                        <TableCell>
                          <ContactAvatar contact={contact} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold">{contact.companyName}</span>
                            {contact.contactType === 'company' && contact.organizationNumber && (
                              <span className="text-xs text-muted-foreground">
                                Org. {contact.organizationNumber}
                              </span>
                            )}
                            {contact.contactType === 'private' && contact.phone && (
                              <span className="text-xs text-muted-foreground">
                                Ph. {contact.phone}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={contact.contactType} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(contact.tags) && contact.tags.length > 0
                              ? contact.tags.map((t: string) => (
                                  <Badge
                                    key={t}
                                    variant="outline"
                                    className="h-5 px-1.5 text-[10px] font-normal"
                                  >
                                    {t}
                                  </Badge>
                                ))
                              : '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{contact.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </Card>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="contacts"
          isLoading={deleting}
        />
      </div>
    </div>
  );
};
