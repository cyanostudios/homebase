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
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import { CONTACT_TYPE_COLORS } from '../types/contacts';
import { contactExportConfig } from '../utils/contactExportConfig';

import { ContactSettingsView, type ContactSettingsCategory } from './ContactSettingsView';

type SortField = 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';
const CONTACTS_VIEW_MODE_STORAGE_KEY = 'contacts:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(CONTACTS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

const CONTACTS_SETTINGS_KEY = 'contacts';
const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

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
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return [...contacts].sort((a, b) => {
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
    const filtered = contacts.filter(
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
  }, [contacts, searchTerm, sortField, sortOrder]);

  const visibleContactIds = useMemo(
    () => sortedContacts.map((contact) => String(contact.id)),
    [sortedContacts],
  );

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
    <div className="plugin-contacts min-h-full bg-background">
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
          <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
            {t('nav.contacts')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('contacts.searchPlaceholder', { count: contacts.length })}
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Settings}
            className="h-9 px-3 text-xs"
            onClick={() => openContactSettings()}
            title={t('contacts.settings')}
          >
            {t('contacts.settings')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Grid3x3}
            className={cn('h-9 px-3 text-xs', viewMode === 'grid' && 'text-primary')}
            onClick={() => setViewMode('grid')}
          >
            {t('contacts.grid')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={ListIcon}
            className={cn('h-9 px-3 text-xs', viewMode === 'list' && 'text-primary')}
            onClick={() => setViewMode('list')}
          >
            {t('contacts.list')}
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

      <div className="px-6 pb-6 space-y-4">
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

        <Card className="shadow-none border-none bg-transparent">
          {sortedContacts.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('contacts.noMatch') : t('contacts.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedContacts.map((contact) => {
                const contactIsSelected = isSelected(contact.id);
                return (
                  <Card
                    key={contact.id}
                    className={cn(
                      'relative p-5 cursor-pointer transition-all flex flex-col min-h-[160px] border border-border/70 bg-card shadow-sm',
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
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={contactIsSelected}
                        onChange={() => toggleContactSelected(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatDisplayNumber('contacts', contact.id)}
                        </span>
                        <Badge className={CONTACT_TYPE_COLORS[contact.contactType]}>
                          {contact.contactType === 'company' ? 'Company' : 'Private'}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="mb-2 line-clamp-1 text-base font-semibold">
                      {contact.companyName}
                    </h3>
                    {(contact.organizationNumber || contact.personalNumber) && (
                      <div className="mb-3 text-xs text-muted-foreground">
                        {contact.contactType === 'company' && contact.organizationNumber && (
                          <span>Org: {contact.organizationNumber}</span>
                        )}
                        {contact.contactType === 'private' && contact.personalNumber && (
                          <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                        )}
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Mail className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs">
                            <Phone className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto border-t pt-4">
                      <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                        <div>Updated: {new Date(contact.updatedAt).toLocaleDateString()}</div>
                        <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : isMobile ? (
            <Card className="shadow-none">
              <div className="space-y-2 p-4">
                {sortedContacts.map((contact) => {
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
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={contactIsSelected}
                              onChange={() => toggleContactSelected(contact.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                              aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatDisplayNumber('contacts', contact.id)}
                            </span>
                            <Badge className={CONTACT_TYPE_COLORS[contact.contactType]}>
                              {contact.contactType === 'company' ? 'Company' : 'Private'}
                            </Badge>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
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
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
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
                      className="cursor-pointer hover:bg-muted/50 select-none"
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
                    <TableHead>Tags</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
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
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedContacts.map((contact) => {
                    const contactIsSelected = isSelected(contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        className={cn(
                          'cursor-pointer hover:bg-accent',
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
                        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={contactIsSelected}
                            onChange={() => toggleContactSelected(contact.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{contact.companyName}</span>
                            {contact.contactType === 'company' && contact.organizationNumber && (
                              <span className="text-xs text-muted-foreground">
                                Org: {contact.organizationNumber}
                              </span>
                            )}
                            {contact.contactType === 'private' && contact.personalNumber && (
                              <span className="text-xs text-muted-foreground">
                                PN: {contact.personalNumber.substring(0, 9)}XXXX
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={CONTACT_TYPE_COLORS[contact.contactType]}>
                            {contact.contactType === 'company' ? 'Company' : 'Private'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(contact.tags) && contact.tags.length > 0
                              ? contact.tags.map((t: string) => (
                                  <Badge
                                    key={t}
                                    variant="secondary"
                                    className="text-[10px] font-normal"
                                  >
                                    {t}
                                  </Badge>
                                ))
                              : '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
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
