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
  Settings,
  Upload,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportItems } from '@/core/utils/exportUtils';
import { ImportSchema } from '@/core/utils/importUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import { CONTACT_TYPE_COLORS } from '../types/contacts';
import { contactExportConfig } from '../utils/contactExportConfig';

type SortField = 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const CONTACTS_SETTINGS_KEY = 'contacts';

const CONTACT_IMPORT_SCHEMA: ImportSchema = {
  fields: [
    { key: 'companyName', label: 'Name', required: true },
    { key: 'contactType', label: 'Type', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
};

export const ContactList: React.FC = () => {
  const { t } = useTranslation();
  const {
    contacts,
    openContactForView,
    openContactSettings,
    importContacts,
    deleteContact,
    deleteContacts,
    selectedContactIds,
    toggleContactSelected,
    selectAllContacts,
    clearContactSelection,
    selectedCount,
    isSelected,
  } = useContacts();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({
    isOpen: false,
    contactId: '',
    contactName: '',
  });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');

  // Load contacts settings from API
  useEffect(() => {
    let cancelled = false;
    getSettings(CONTACTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setViewModeState(settings?.viewMode === 'grid' ? 'grid' : 'list');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      updateSettings(CONTACTS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to asc
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

  // Visible contact IDs for selection
  const visibleContactIds = useMemo(
    () => sortedContacts.map((contact) => String(contact.id)),
    [sortedContacts],
  );

  // Selection helpers
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

  const _handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, contactId: id, contactName: name });
  };

  const confirmDelete = () => {
    deleteContact(deleteConfirm.contactId);
    setDeleteConfirm({ isOpen: false, contactId: '', contactName: '' });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, contactId: '', contactName: '' });
  };

  // Export handlers
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

  // Set header trailing (search + view mode toggle) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('contacts.searchPlaceholder')}
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openContactSettings()}
              className="h-7 text-[10px] px-2"
            >
              {t('slots.settings')}
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className="h-7 text-[10px] px-2"
            >
              {t('slots.grid')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              icon={ListIcon}
              onClick={() => setViewMode('list')}
              className="h-7 text-[10px] px-2"
            >
              {t('slots.list')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportWizardOpen(true)}
              className="h-7 text-[10px] px-2"
            >
              Import
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [t, searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing, openContactSettings]);

  // Protected navigation handlers
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

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearContactSelection}
        actions={[
          {
            label: t('bulk.sendMessageTitle'),
            icon: MessageSquare,
            onClick: () => setShowBulkMessageDialog(true),
          },
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          {
            label: 'Export PDF',
            icon: FileText,
            onClick: handleExportPDF,
            variant: 'default',
          },
          {
            label: t('common.delete'),
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <BulkMessageDialog
        isOpen={showBulkMessageDialog}
        onClose={() => setShowBulkMessageDialog(false)}
        recipients={bulkMessageRecipients}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedContacts.map((contact) => {
              const contactIsSelected = isSelected(contact.id);
              return (
                <Card
                  key={contact.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent bg-gray-50 dark:bg-gray-900/40',
                    contactIsSelected
                      ? 'plugin-contacts bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md',
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contactIsSelected}
                        onChange={() => toggleContactSelected(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatDisplayNumber('contacts', contact.id)}
                      </span>
                    </div>
                    <Badge className={CONTACT_TYPE_COLORS[contact.contactType]}>
                      {contact.contactType === 'company' ? 'Company' : 'Private'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-1">
                    {contact.companyName}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    {contact.contactType === 'company' && contact.organizationNumber && (
                      <span>Org: {contact.organizationNumber}</span>
                    )}
                    {contact.contactType === 'private' && contact.personalNumber && (
                      <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground mt-1 pt-2 border-t border-dashed">
                      <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : isMobile ? (
          // Mobile: Card layout
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
          // Desktop: Table layout
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
                      className="cursor-pointer hover:bg-accent"
                      tabIndex={0}
                      data-list-item={JSON.stringify(contact)}
                      data-plugin-name="contacts"
                      role="button"
                      aria-label={`Open contact ${contact.companyName}`}
                      onClick={(e) => {
                        // Don't open if clicking checkbox
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

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="contacts"
        isLoading={deleting}
      />

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importContacts}
        schema={CONTACT_IMPORT_SCHEMA}
        title="Import Contacts"
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('contacts.deleteTitle')}
        message={`Are you sure you want to delete "${deleteConfirm.contactName}"? This action cannot be undone.`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
