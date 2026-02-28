import {
  Mail,
  Phone,
  Building,
  User,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  ListPlus,
  Upload,
  FolderPlus,
  ChevronRight,
  Plus,
  Pencil,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import { contactsApi } from '../api/contactsApi';
import { ContactPicker } from './ContactPicker';
import { CONTACT_TYPE_COLORS } from '../types/contacts';
import { contactExportConfig } from '../utils/contactExportConfig';
import type { ImportSchema } from '@/core/utils/importUtils';

type SortField = 'contactNumber' | 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'homebase-contacts-view-mode';

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
  const { contacts, openContactForView, deleteContact, deleteContacts, importContacts } =
    useContacts();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({
    isOpen: false,
    contactId: '',
    contactName: '',
  });

  const [sortField, setSortField] = useState<SortField>('contactNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(VIEW_MODE_KEY);
      return s === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const [showImportWizard, setShowImportWizard] = useState(false);

  type ContentView = 'all' | 'lists';
  const [activeContentView, setActiveContentView] = useState<ContentView>('all');
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listContacts, setListContacts] = useState<any[]>([]);
  const [listContactsLoading, setListContactsLoading] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  // Add to list dropdown (from contact list view)
  const [addToListLists, setAddToListLists] = useState<Array<{ id: string; name: string }>>([]);
  const [addToListLoading, setAddToListLoading] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [createListDialogName, setCreateListDialogName] = useState('');
  const [createListDialogSaving, setCreateListDialogSaving] = useState(false);

  useEffect(() => {
    if (activeContentView !== 'lists') return;
    setListsLoading(true);
    contactsApi
      .getLists()
      .then((data) => setLists(data || []))
      .catch((err) => console.error('Failed to load contact lists:', err))
      .finally(() => setListsLoading(false));
  }, [activeContentView]);

  useEffect(() => {
    if (!selectedListId) {
      setListContacts([]);
      return;
    }
    setListContactsLoading(true);
    contactsApi
      .getListContacts(selectedListId)
      .then((data) => setListContacts(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to load list contacts:', err))
      .finally(() => setListContactsLoading(false));
  }, [selectedListId]);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const created = await contactsApi.createList(name);
      setLists((prev) => [...prev, { id: created.id, name: created.name }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewListName('');
    } catch (err) {
      console.error('Create list failed:', err);
    }
  };

  const handleRenameList = async (listId: string) => {
    const name = editingListName.trim();
    if (!name) return;
    try {
      await contactsApi.renameList(listId, name);
      setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
      setEditingListId(null);
      setEditingListName('');
    } catch (err) {
      console.error('Rename list failed:', err);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Ta bort listan? Kontakterna tas inte bort, bara kopplingen.')) return;
    try {
      await contactsApi.deleteList(listId);
      setLists((prev) => prev.filter((l) => l.id !== listId));
      if (selectedListId === listId) setSelectedListId(null);
    } catch (err) {
      console.error('Delete list failed:', err);
    }
  };

  const handleAddContactsToList = (contactIds: string[]) => {
    if (!selectedListId) return;
    const currentIds = listContacts.map((c: any) => String(c.id));
    const toAdd = contactIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !contactIds.includes(id));
    const promises: Promise<any>[] = [];
    if (toAdd.length > 0) {
      promises.push(contactsApi.addContactsToList(selectedListId, toAdd));
    }
    toRemove.forEach((id) => promises.push(contactsApi.removeContactFromList(selectedListId, id)));
    Promise.all(promises)
      .then(() => contactsApi.getListContacts(selectedListId))
      .then((data) => setListContacts(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Sync list contacts failed:', err));
    setShowContactPicker(false);
  };

  const fetchListsForAddToList = () => {
    setAddToListLoading(true);
    contactsApi
      .getLists()
      .then((data) => setAddToListLists(data || []))
      .catch((err) => console.error('Failed to load lists:', err))
      .finally(() => setAddToListLoading(false));
  };

  const handleAddSelectedToList = (listId: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    contactsApi
      .addContactsToList(listId, ids)
      .then(() => setSelectedIds(new Set()))
      .catch((err) => console.error('Add contacts to list failed:', err));
  };

  const openCreateListDialog = () => {
    setCreateListDialogName('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShowCreateListDialog(true));
    });
  };

  const handleCreateListDialogSubmit = () => {
    const name = createListDialogName.trim();
    if (!name || selectedIds.size === 0) return;
    setCreateListDialogSaving(true);
    contactsApi
      .createList(name)
      .then((list) => {
        return contactsApi.addContactsToList(list.id, Array.from(selectedIds)).then(() => list);
      })
      .then((list) => {
        setLists((prev) =>
          [...prev, { id: String(list.id), name: list.name }].sort((a, b) => a.name.localeCompare(b.name))
        );
        setSelectedIds(new Set());
        setShowCreateListDialog(false);
        setCreateListDialogName('');
      })
      .catch((err) => console.error('Create list / add contacts failed:', err))
      .finally(() => setCreateListDialogSaving(false));
  };

  const handleRemoveContactFromList = (contactId: string) => {
    if (!selectedListId) return;
    contactsApi
      .removeContactFromList(selectedListId, contactId)
      .then(() => setListContacts((prev) => prev.filter((c: any) => String(c.id) !== String(contactId))))
      .catch((err) => console.error('Remove contact from list failed:', err));
  };

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search contacts..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={activeContentView === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setActiveContentView('all')}
              title="Alla kontakter"
            >
              Kontakter
            </Button>
            <Button
              variant={activeContentView === 'lists' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setActiveContentView('lists')}
              title="Mina listor"
            >
              <FolderPlus className="h-4 w-4" />
              Listor
            </Button>
            {activeContentView === 'all' && (
              <>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3x3 className="h-4 w-4" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="h-4 w-4" />
                  List
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowImportWizard(true)}
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
              </>
            )}
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, activeContentView, setHeaderTrailing]);

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
    const filtered = contacts.filter(
      (contact) =>
        contact.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.contactNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.organizationNumber &&
          contact.organizationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.personalNumber &&
          contact.personalNumber.toLowerCase().includes(searchTerm.toLowerCase())),
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
      } else if (sortField === 'email') {
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
      } else {
        aValue = a.contactNumber;
        bValue = b.contactNumber;
      }

      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [contacts, searchTerm, sortField, sortOrder]);

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

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedContacts.length > 0 &&
    sortedContacts.every((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedContacts.map((c) => c.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    try {
      await deleteContacts(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
      alert('Please select contacts to export');
      return;
    }
    const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
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
    if (selectedIds.size === 0) {
      alert('Please select contacts to export');
      return;
    }
    const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
    const filename = `contacts-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selectedContacts,
      format: 'pdf',
      config: contactExportConfig,
      filename,
      title: 'Contacts Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err) => {
        console.error('PDF export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  };

  // Protected navigation handlers
  const handleOpenForView = (contact: any) => attemptNavigation(() => openContactForView(contact));

  return (
    <div className="space-y-4">
      {activeContentView === 'all' && (
        <div className="flex flex-col gap-2">
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={() => setSelectedIds(new Set())}
            actions={[
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
                label: 'Delete…',
                icon: Trash2,
                onClick: () => setBulkDeleteOpen(true),
                variant: 'destructive',
              },
            ]}
          />
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu onOpenChange={(open) => open && fetchListsForAddToList()}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" title="Lägg till i lista">
                    <ListPlus className="w-4 h-4 mr-1" />
                    Add to list ({selectedCount})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  {addToListLoading ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Laddar listor...</div>
                  ) : (
                    <>
                      {addToListLists.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">Inga listor</div>
                      ) : (
                        addToListLists.map((list) => (
                          <DropdownMenuItem
                            key={list.id}
                            onSelect={() => handleAddSelectedToList(list.id)}
                          >
                            <FolderPlus className="w-4 h-4 mr-2" />
                            {list.name}
                          </DropdownMenuItem>
                        ))
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openCreateListDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Skapa ny
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}

      {activeContentView === 'lists' ? (
        <Card className="shadow-none">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Ny listas namn"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              />
              <Button size="sm" onClick={handleCreateList} disabled={!newListName.trim()}>
                <Plus className="h-4 w-4" />
                Skapa lista
              </Button>
            </div>
            {listsLoading ? (
              <div className="text-sm text-muted-foreground">Laddar listor...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Listor</h3>
                  <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                    {lists.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">Inga listor. Skapa en ovan.</div>
                    ) : (
                      lists.map((list) => (
                        <div
                          key={list.id}
                          className={`flex items-center gap-2 px-3 py-2 group ${
                            selectedListId === list.id ? 'bg-muted' : 'hover:bg-muted/50'
                          }`}
                        >
                          {editingListId === list.id ? (
                            <>
                              <Input
                                value={editingListName}
                                onChange={(e) => setEditingListName(e.target.value)}
                                className="h-8 flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameList(list.id);
                                  if (e.key === 'Escape') setEditingListId(null);
                                }}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={() => handleRenameList(list.id)}>
                                Spara
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingListId(null)}>
                                Avbryt
                              </Button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="flex-1 flex items-center gap-2 text-left min-w-0"
                                onClick={() => setSelectedListId(list.id)}
                              >
                                <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                <span className="truncate">{list.name}</span>
                              </button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100"
                                onClick={() => {
                                  setEditingListId(list.id);
                                  setEditingListName(list.name);
                                }}
                                aria-label="Byt namn"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => handleDeleteList(list.id)}
                                aria-label="Ta bort lista"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center justify-between">
                    <span>
                      {selectedListId ? lists.find((l) => l.id === selectedListId)?.name ?? 'Kontakter' : 'Välj en lista'}
                    </span>
                    {selectedListId && (
                      <Button size="sm" variant="outline" onClick={() => setShowContactPicker(true)}>
                        <Pencil className="h-4 w-4" />
                        Redigera kontakter
                      </Button>
                    )}
                  </h3>
                  {selectedListId && (
                    <div className="border rounded-md max-h-[400px] overflow-y-auto">
                      {listContactsLoading ? (
                        <div className="p-4 text-sm text-muted-foreground">Laddar kontakter...</div>
                      ) : listContacts.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          Inga kontakter i listan. Klicka &quot;Redigera kontakter&quot; för att lägga till.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {listContacts.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-2 px-3 py-2 group">
                              <User className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-sm">{c.companyName || c.email || 'Namnlös'}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {c.email}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => handleRemoveContactFromList(String(c.id))}
                                aria-label="Ta bort från listan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
      <Card className="shadow-none">
        {sortedContacts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No contacts found matching your search.'
              : 'No contacts yet. Click "Add Contact" to get started.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedContacts.map((contact) => (
              <Card
                key={contact.id}
                className={cn(
                  'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent',
                  selectedIds.has(contact.id)
                    ? 'plugin-contacts bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                    : 'hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md',
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
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
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelectOne(contact.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer h-4 w-4"
                      aria-label={selectedIds.has(contact.id) ? 'Unselect contact' : 'Select contact'}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      #{contact.contactNumber}
                    </span>
                  </div>
                  <Badge className={CONTACT_TYPE_COLORS[contact.contactType]}>
                    {contact.contactType === 'company' ? 'Company' : 'Private'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-base mb-1 line-clamp-1">{contact.companyName}</h3>
                <div className="text-xs text-muted-foreground mb-4">
                  {contact.contactType === 'company' && contact.organizationNumber && (
                    <span>Org: {contact.organizationNumber}</span>
                  )}
                  {contact.contactType === 'private' && contact.personalNumber && (
                    <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
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
                  <div className="text-[10px] text-muted-foreground mt-1 pt-2 border-t border-dashed border-gray-100 dark:border-gray-800">
                    Created: {new Date(contact.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={allSelected ? 'Deselect all contacts' : 'Select all contacts'}
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('contactNumber')}
                >
                  <div className="flex items-center gap-2">
                    <span>#</span>
                    {sortField === 'contactNumber' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
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
              {sortedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  tabIndex={0}
                  data-list-item={JSON.stringify(contact)}
                  data-plugin-name="contacts"
                  role="button"
                  aria-label={`Open contact ${contact.companyName}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenForView(contact);
                  }}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelectOne(contact.id)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Select ${contact.companyName}`}
                    />
                  </TableCell>
                  <TableCell className="w-12">
                    {contact.contactType === 'company' ? (
                      <Building className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User className="w-4 h-4 text-green-500 dark:text-green-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{contact.contactNumber}
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
                    <Badge
                      className={
                        contact.contactType === 'company'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      }
                    >
                      {contact.contactType === 'company' ? 'Company' : 'Private'}
                    </Badge>
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      )}

      {showContactPicker && (
        <Dialog open onOpenChange={() => setShowContactPicker(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Redigera lista</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Välj eller avvälj kontakter. Ändringarna sparas när du klickar på Uppdatera.
            </p>
            <ContactPicker
              selectedIds={listContacts.map((c: any) => String(c.id))}
              onSelect={handleAddContactsToList}
              onClose={() => setShowContactPicker(false)}
              confirmLabel="Uppdatera lista"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Create new list (from Add to list) */}
      <Dialog open={showCreateListDialog} onOpenChange={setShowCreateListDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skapa ny lista</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedCount} kontakt{selectedCount !== 1 ? 'er' : ''} läggs i den nya listan.
          </p>
          <Input
            placeholder="Listans namn"
            value={createListDialogName}
            onChange={(e) => setCreateListDialogName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateListDialogSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateListDialog(false)}
              disabled={createListDialogSaving}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleCreateListDialogSubmit}
              disabled={!createListDialogName.trim() || createListDialogSaving}
            >
              <Plus className="w-4 h-4 mr-1" />
              {createListDialogSaving ? 'Skapar…' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={importContacts}
        schema={CONTACT_IMPORT_SCHEMA}
        title="Import Contacts"
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteConfirm.contactName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="contacts"
        isLoading={bulkDeleting}
      />
    </div>
  );
};
