import { File, Trash2, Grid3x3, List, ChevronUp, ChevronDown, Cloud, Settings, X, FolderOpen, Image, FolderPlus, ListPlus, Plus, Pencil, ChevronRight, ChevronLeft, Folder, Move } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';


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
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useFiles } from '../hooks/useFiles';
import { filesApi } from '../api/filesApi';
import { CloudStorageSettings } from './CloudStorageSettings';
import { FilePicker } from './FilePicker';

type SortField = 'name' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

function humanSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return File;
  if (mimeType.includes('word') || mimeType.includes('document')) return File;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return File;
  return File;
}

export const FileList: React.FC = () => {
  const {
    files,
    openFileForView,
    cloudStorageSettings,
    getCloudStorageEmbedUrl,
    currentFolderPath,
    setCurrentFolderPath,
    folders,
    loadFolders,
    createFolder,
    moveFile,
    refetchFiles,
    // Selection API
    selectedFileIds,
    selectedFolderPaths,
    toggleFileSelected,
    toggleFolderSelected,
    selectAllFiles,
    selectAllVisible,
    clearFileSelection,
    // Bulk delete
    deleteFiles,
  } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [openingCloudService, setOpeningCloudService] = useState<string | null>(null);
  type StorageView = 'all' | 'local' | 'lists';
  const [activeStorageView, setActiveStorageView] = useState<StorageView>('all');
  // Lists tab state
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listFiles, setListFiles] = useState<any[]>([]);
  const [listFilesLoading, setListFilesLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  // Add to list dropdown: lists fetched when dropdown opens
  const [addToListLists, setAddToListLists] = useState<Array<{ id: string; name: string }>>([]);
  const [addToListLoading, setAddToListLoading] = useState(false);
  // Create-new-list dialog (from Add to list)
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [createListDialogName, setCreateListDialogName] = useState('');
  const [createListDialogSaving, setCreateListDialogSaving] = useState(false);
  // Move to folder
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  // Create folder
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('');
  const [createFolderSaving, setCreateFolderSaving] = useState(false);
  const [createFolderAndMove, setCreateFolderAndMove] = useState(false);

  // Clean up OAuth callback query params
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('cloud') || url.searchParams.has('connected')) {
      url.searchParams.delete('cloud');
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  // Load lists when "Mina listor" tab is active
  useEffect(() => {
    if (activeStorageView !== 'lists') return;
    setListsLoading(true);
    filesApi
      .getLists()
      .then((data) => setLists(data || []))
      .catch((err) => console.error('Failed to load lists:', err))
      .finally(() => setListsLoading(false));
  }, [activeStorageView]);

  // Load list files when a list is selected
  useEffect(() => {
    if (!selectedListId) {
      setListFiles([]);
      return;
    }
    setListFilesLoading(true);
    filesApi
      .getListFiles(selectedListId)
      .then((data) => setListFiles(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to load list files:', err))
      .finally(() => setListFilesLoading(false));
  }, [selectedListId]);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const created = await filesApi.createList(name);
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
      await filesApi.renameList(listId, name);
      setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
      setEditingListId(null);
      setEditingListName('');
    } catch (err) {
      console.error('Rename list failed:', err);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Ta bort listan? Filerna tas inte bort, bara kopplingen.')) return;
    try {
      await filesApi.deleteList(listId);
      setLists((prev) => prev.filter((l) => l.id !== listId));
      if (selectedListId === listId) setSelectedListId(null);
    } catch (err) {
      console.error('Delete list failed:', err);
    }
  };

  const handleAddFilesToList = (fileIds: string[]) => {
    if (!selectedListId || fileIds.length === 0) return;
    filesApi
      .addFilesToList(selectedListId, fileIds)
      .then(() => {
        return filesApi.getListFiles(selectedListId);
      })
      .then((data) => setListFiles(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Add files to list failed:', err));
    setShowFilePicker(false);
  };

  const fetchListsForAddToList = () => {
    setAddToListLoading(true);
    filesApi
      .getLists()
      .then((data) => setAddToListLists(data || []))
      .catch((err) => console.error('Failed to load lists:', err))
      .finally(() => setAddToListLoading(false));
  };

  const handleAddSelectedToList = (listId: string) => {
    if (selectedFileIds.length === 0) return;
    filesApi
      .addFilesToList(listId, selectedFileIds)
      .then(() => {
        clearFileSelection();
      })
      .catch((err) => console.error('Add files to list failed:', err));
  };

  const openCreateListDialog = () => {
    setCreateListDialogName('');
    // Defer so dropdown can close and remove its overlay first; avoids invisible overlay left on top
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShowCreateListDialog(true));
    });
  };

  const handleCreateListDialogSubmit = () => {
    const name = createListDialogName.trim();
    if (!name || selectedFileIds.length === 0) return;
    setCreateListDialogSaving(true);
    filesApi
      .createList(name)
      .then((list) => filesApi.addFilesToList(list.id, selectedFileIds))
      .then(() => {
        clearFileSelection();
        setShowCreateListDialog(false);
        setCreateListDialogName('');
      })
      .catch((err) => console.error('Create list / add files failed:', err))
      .finally(() => setCreateListDialogSaving(false));
  };

  const handleRemoveFileFromList = (fileId: string) => {
    if (!selectedListId) return;
    filesApi
      .removeFileFromList(selectedListId, fileId)
      .then(() => setListFiles((prev) => prev.filter((f: any) => String(f.id) !== String(fileId))))
      .catch((err) => console.error('Remove file from list failed:', err));
  };

  const normalized = (it: any) => ({
    id: String(it.id ?? ''),
    name: String(it.name ?? ''),
    mimeType: it.mimeType ? String(it.mimeType) : '',
    size: typeof it.size === 'number' ? it.size : null,
    updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
    url: it.url ? String(it.url) : '',
    raw: it,
  });

  // Subfolders of current path (immediate children)
  const subfolders = useMemo(() => {
    const base = currentFolderPath ?? '';
    return folders.filter((f) => {
      if (base === '') return f.indexOf('/') === -1;
      const prefix = base + '/';
      if (!f.startsWith(prefix)) return false;
      return f.slice(prefix.length).indexOf('/') === -1;
    });
  }, [folders, currentFolderPath]);

  const breadcrumbs = useMemo(() => {
    if (!currentFolderPath) return [{ path: null, label: 'Root' }];
    const parts = currentFolderPath.split('/').filter(Boolean);
    const result = [{ path: null, label: 'Root' }];
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      result.push({ path: acc, label: p });
    }
    return result;
  }, [currentFolderPath]);

  const handleCreateFolder = async () => {
    const name = createFolderName.trim();
    if (!name) return;
    const shouldMove = createFolderAndMove && selectedFileIds.length > 0;
    setCreateFolderSaving(true);
    try {
      const base = currentFolderPath ?? '';
      const fullPath = base ? `${base}/${name}` : name;
      await createFolder(fullPath);
      setShowCreateFolderDialog(false);
      setCreateFolderName('');
      setCreateFolderAndMove(false);
      if (shouldMove) {
        await handleMoveSelected(fullPath);
      }
      setCurrentFolderPath(fullPath);
      if (shouldMove) {
        await refetchFiles(fullPath);
      }
    } catch (err) {
      console.error('Create folder failed:', err);
    } finally {
      setCreateFolderSaving(false);
    }
  };

  const openCreateFolderDialog = (andMoveSelected = false) => {
    setCreateFolderName('');
    setCreateFolderAndMove(andMoveSelected);
    // Defer when from dropdown so it can close and remove overlay first; avoids invisible overlay blocking clicks
    if (andMoveSelected) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShowCreateFolderDialog(true));
      });
    } else {
      setShowCreateFolderDialog(true);
    }
  };

  const handleMoveSelected = async (targetPath: string | null) => {
    if (selectedFileIds.length === 0) return;
    setMoving(true);
    try {
      for (const id of selectedFileIds) {
        await moveFile(id, targetPath);
      }
      clearFileSelection();
      setMoveTargetFolder(null);
    } catch (err) {
      console.error('Move failed:', err);
    } finally {
      setMoving(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = files.map(normalized).filter((it) => {
      if (!needle) {
        return true;
      }
      return (
        it.name.toLowerCase().includes(needle) ||
        it.id.toLowerCase().includes(needle) ||
        it.mimeType.toLowerCase().includes(needle)
      );
    });

    const cmp = (a: any, b: any) => {
      let av: any;
      let bv: any;
      switch (sortField) {
        case 'updatedAt':
          av = a.updatedAt ? a.updatedAt.getTime() : 0;
          bv = b.updatedAt ? b.updatedAt.getTime() : 0;
          break;
        case 'id':
          av = a.id.toLowerCase();
          bv = b.id.toLowerCase();
          break;
        case 'name':
        default:
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const res = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [files, searchTerm, sortField, sortOrder]);

  // Combined list: folders first (explorer-style), then files
  const listItems = useMemo(() => {
    const folderItems = subfolders.map((f) => ({
      type: 'folder' as const,
      path: f,
      label: currentFolderPath ? f.slice(currentFolderPath.length + 1) : f,
    })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    const fileItems = filteredAndSorted.map((f) => ({ type: 'file' as const, ...f }));
    return [...folderItems, ...fileItems];
  }, [subfolders, currentFolderPath, filteredAndSorted]);

  // Selected files (actual objects)
  const selectedFiles = useMemo(() => {
    const set = new Set(selectedFileIds.map(String));
    return files.filter((f: any) => set.has(String(f?.id)));
  }, [files, selectedFileIds]);

  // Selection helpers (files + folders)
  const visibleFileIds = useMemo(
    () => listItems.filter((item: any) => item.type === 'file').map((item: any) => String(item.id)),
    [listItems],
  );
  const visibleFolderPaths = useMemo(
    () => listItems.filter((item: any) => item.type === 'folder').map((item: any) => item.path),
    [listItems],
  );
  const allVisibleSelected = useMemo(
    () =>
      (visibleFileIds.length > 0 || visibleFolderPaths.length > 0) &&
      visibleFileIds.every((id) => selectedFileIds.includes(id)) &&
      visibleFolderPaths.every((p) => selectedFolderPaths.includes(p)),
    [visibleFileIds, visibleFolderPaths, selectedFileIds, selectedFolderPaths],
  );
  const someVisibleSelected = useMemo(
    () =>
      visibleFileIds.some((id) => selectedFileIds.includes(id)) ||
      visibleFolderPaths.some((p) => selectedFolderPaths.includes(p)),
    [visibleFileIds, visibleFolderPaths, selectedFileIds, selectedFolderPaths],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = () => {
    if (allVisibleSelected) {
      selectAllVisible(
        selectedFileIds.filter((id) => !visibleFileIds.includes(id)),
        selectedFolderPaths.filter((p) => !visibleFolderPaths.includes(p)),
      );
    } else {
      selectAllVisible(
        Array.from(new Set([...selectedFileIds, ...visibleFileIds])),
        Array.from(new Set([...selectedFolderPaths, ...visibleFolderPaths])),
      );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenForView = (item: any) => attemptNavigation(() => openFileForView(item));

  const runDeleteFlow = async () => {
    if (selectedFileIds.length === 0 && selectedFolderPaths.length === 0) return;
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds, selectedFolderPaths);
      setShowDeleteModal(false);
      clearFileSelection();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const total = files.length;
  const filtered = filteredAndSorted.length;

  const handleOpenCloud = async (service: 'googledrive') => {
    setOpeningCloudService(service);
    try {
      const embedUrl = await getCloudStorageEmbedUrl(service);
      if (embedUrl) {
        window.open(embedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert(`Could not open ${service}. Check Settings.`);
      }
    } catch (err) {
      console.error(`Failed to open ${service}:`, err);
      alert(`Failed to open Google Drive file manager`);
    } finally {
      setOpeningCloudService(null);
    }
  };

  const connectedServices = [
    cloudStorageSettings.googledrive?.connected && { name: 'googledrive', label: 'Google Drive', icon: '☁️' },
  ].filter(Boolean) as Array<{ name: string; label: string; icon: string }>;

  const viewToggleActions = (
    <>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setViewMode('grid')}
        title="Grid view"
      >
        <Grid3x3 className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setViewMode('list')}
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => openCreateFolderDialog(false)}
        title="Skapa mapp"
      >
        <FolderPlus className="h-4 w-4" />
        Skapa mapp
      </Button>
    </>
  );

  const toolbarActions = (
    <div className="flex items-center gap-2">
      {viewToggleActions}
      {(selectedFileIds.length > 0 || selectedFolderPaths.length > 0) && (
        <>
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) {
                fetchListsForAddToList();
                loadFolders();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="Lägg till i lista" disabled={selectedFileIds.length === 0}>
                <ListPlus className="h-4 w-4" />
                Add to list{selectedFileIds.length > 0 ? ` (${selectedFileIds.length})` : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
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
          <DropdownMenu
            onOpenChange={(open) => open && loadFolders()}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="Flytta till mapp" disabled={moving || selectedFileIds.length === 0}>
                <Move className="h-4 w-4" />
                {moving ? 'Flyttar…' : 'Flytta till mapp'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem] max-h-[280px] overflow-y-auto">
              <DropdownMenuItem onSelect={() => openCreateFolderDialog(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Ny mapp…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleMoveSelected(null)}>
                <Folder className="w-4 h-4 mr-2" />
                Root
              </DropdownMenuItem>
              {folders.map((f) => (
                <DropdownMenuItem key={f} onSelect={() => handleMoveSelected(f)}>
                  <Folder className="w-4 h-4 mr-2" />
                  <span className="truncate">{f}</span>
                </DropdownMenuItem>
              ))}
              {folders.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">Inga mappar</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedFileIds.length + selectedFolderPaths.length}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filtered !== total ? `${filtered} of ${total}` : `${total}`} files
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">View:</span>
            <Button
              variant={activeStorageView === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveStorageView('all')}
              title="All files and cloud storage"
            >
              <span>📂 All Files</span>
            </Button>
            <Button
              variant={activeStorageView === 'local' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveStorageView('local')}
              title="My files"
            >
              <FolderOpen className="w-4 h-4" />
              <span>My files</span>
            </Button>
            <Button
              variant={activeStorageView === 'lists' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveStorageView('lists')}
              title="Mina listor"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Mina listor</span>
            </Button>
            {connectedServices.length > 0 && (
              <>
                {connectedServices.map((service) => (
                  <Button
                    key={service.name}
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCloud(service.name as 'googledrive')}
                    disabled={openingCloudService === service.name}
                    title={`Open ${service.label} in new tab`}
                  >
                    <span>{service.icon}</span>
                    <span>{service.label}</span>
                    {openingCloudService === service.name && <span className="animate-pulse">...</span>}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCloudSettings(true)}
                  title="Manage cloud storage"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </>
            )}
            {connectedServices.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCloudSettings(true)}
              >
                <Cloud className="h-4 w-4" />
                Connect cloud storage
              </Button>
            )}
          </div>
          {(selectedFileIds.length > 0 || selectedFolderPaths.length > 0) && (
            <div className="mt-2 text-sm flex items-center flex-wrap gap-2">
              <Badge variant="secondary">{selectedFileIds.length + selectedFolderPaths.length} selected</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearFileSelection()}
              >
                Clear selection
              </Button>
            </div>
          )}
        </div>
      </div>

      {activeStorageView === 'local' && (
        <>
          <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
            <div className="flex items-center gap-1 flex-wrap text-sm">
              {breadcrumbs.map((b, i) => (
                <span key={b.path ?? 'root'} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <button
                    type="button"
                    className={`hover:underline ${i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setCurrentFolderPath(b.path)}
                  >
                    {b.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
          <ContentToolbar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by name, id, or type..."
            rightActions={toolbarActions}
          />
        </>
      )}

      <Card className="shadow-none">
        {activeStorageView === 'lists' ? (
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
                    <span>{selectedListId ? lists.find((l) => l.id === selectedListId)?.name ?? 'Filer' : 'Välj en lista'}</span>
                    {selectedListId && (
                      <Button size="sm" variant="outline" onClick={() => setShowFilePicker(true)}>
                        <Plus className="h-4 w-4" />
                        Lägg till filer
                      </Button>
                    )}
                  </h3>
                  {selectedListId && (
                    <div className="border rounded-md max-h-[400px] overflow-y-auto">
                      {listFilesLoading ? (
                        <div className="p-4 text-sm text-muted-foreground">Laddar filer...</div>
                      ) : listFiles.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">Inga filer i listan. Klicka &quot;Lägg till filer&quot;.</div>
                      ) : (
                        <div className="divide-y">
                          {listFiles.map((f: any) => (
                            <div key={f.id} className="flex items-center gap-2 px-3 py-2 group">
                              <File className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-sm">{f.name || 'Namnlös'}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => handleRemoveFileFromList(String(f.id))}
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
            {showFilePicker && selectedListId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilePicker(false)} />
                <Card className="relative z-10 w-full max-w-md p-4">
                  <h3 className="text-sm font-semibold mb-3">Lägg till filer i listan</h3>
                  <FilePicker
                    selectedIds={listFiles.map((f: any) => String(f.id))}
                    onSelect={handleAddFilesToList}
                    onClose={() => setShowFilePicker(false)}
                  />
                </Card>
              </div>
            )}
          </div>
        ) : activeStorageView === 'all' ? (
          <div className="space-y-6">
            {/* Local Files Section */}
            <div>
              <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  My Files ({filtered} {filtered === 1 ? 'file' : 'files'})
                </h3>
                <div className="flex items-center gap-1 flex-wrap text-sm">
                  {breadcrumbs.map((b, i) => (
                    <span key={b.path ?? 'root'} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <button
                        type="button"
                        className={`hover:underline ${i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setCurrentFolderPath(b.path)}
                      >
                        {b.label}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <ContentToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search by name, id, or type..."
                rightActions={toolbarActions}
              />
              {viewMode === 'grid' ? (
                <div className="p-4">
                  {listItems.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      {searchTerm
                        ? 'No files found matching your search.'
                        : 'No files yet. Click "Add File" to get started.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {listItems.map((item: any) => {
                        if (item.type === 'folder') {
                          const isFolderSelected = selectedFolderPaths.includes(item.path);
                          return (
                            <div
                              key={`folder-${item.path}`}
                              className={`plugin-files relative rounded-lg border p-3 cursor-pointer transition-all ${
                                isFolderSelected ? 'bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50' : 'border-border hover:border-plugin-subtle hover:shadow-md'
                              }`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                                e.preventDefault();
                                setCurrentFolderPath(item.path);
                              }}
                            >
                              <div className="absolute top-2 left-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer"
                                  checked={isFolderSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => toggleFolderSelected(item.path)}
                                  aria-label={isFolderSelected ? 'Avmarkera mapp' : 'Markera mapp'}
                                />
                              </div>
                              <div className="mt-6 flex flex-col items-center text-center">
                                <div className="w-full h-24 flex items-center justify-center bg-muted rounded mb-2">
                                  <Folder className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate w-full" title={item.label}>
                                  {item.label}
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5">Mapp</div>
                              </div>
                            </div>
                          );
                        }
                        const row = item;
                        const isSelected = selectedFileIds.includes(row.id);
                        const FileIcon = getFileIcon(row.mimeType);
                        const isImage = row.mimeType?.startsWith('image/');
                        return (
                          <div
                            key={row.id}
                            className={`plugin-files relative rounded-lg border p-3 cursor-pointer transition-all ${isSelected
                              ? 'bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                              : 'border-border hover:border-plugin-subtle hover:shadow-md'
                              }`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleOpenForView(row.raw);
                            }}
                          >
                            <div className="absolute top-2 left-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer"
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleFileSelected(row.id)}
                                aria-label={isSelected ? 'Unselect file' : 'Select file'}
                              />
                            </div>
                            <div className="mt-6 flex flex-col items-center text-center">
                              {isImage && row.url ? (
                                <img
                                  src={row.url}
                                  alt={row.name}
                                  className="w-full h-24 object-cover rounded mb-2"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-24 flex items-center justify-center bg-muted rounded mb-2">
                                  <FileIcon className="w-8 h-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate w-full" title={row.name}>
                                {row.name || '—'}
                              </div>
                              <div className="text-sm text-muted-foreground mt-0.5">{humanSize(row.size)}</div>
                              <div className="mt-2 flex items-center justify-between w-full text-[10px] text-muted-foreground pt-2 border-t border-gray-100 dark:border-gray-800">
                                <span>{row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}</span>
                                <span className="font-mono">#{row.id}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-input"
                          aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                          checked={allVisibleSelected}
                          onChange={onToggleAllVisible}
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Name
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('updatedAt')}
                      >
                        <div className="flex items-center gap-2">
                          Updated
                          <SortIcon field="updatedAt" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">
                          {searchTerm
                            ? 'No files found matching your search.'
                            : 'No files yet. Click "Add File" to get started.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      listItems.map((item: any) => {
                        if (item.type === 'folder') {
                          const isFolderSelected = selectedFolderPaths.includes(item.path);
                          return (
                            <TableRow
                              key={`folder-${item.path}`}
                              className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 ${isFolderSelected ? 'bg-plugin-subtle' : ''}`}
                              tabIndex={0}
                              role="button"
                              aria-label={`Open folder ${item.label}`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                                e.preventDefault();
                                setCurrentFolderPath(item.path);
                              }}
                            >
                              <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer rounded border-input"
                                  checked={isFolderSelected}
                                  onChange={() => toggleFolderSelected(item.path)}
                                  aria-label={isFolderSelected ? 'Avmarkera mapp' : 'Markera mapp'}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Folder className="w-4 h-4 text-muted-foreground" />
                                  <div className="font-medium">{item.label}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">Mapp</div>
                              </TableCell>
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          );
                        }
                        const row = item;
                        const isSelected = selectedFileIds.includes(row.id);
                        return (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                            tabIndex={0}
                            data-list-item={JSON.stringify(row.raw)}
                            data-plugin-name="files"
                            role="button"
                            aria-label={`Open file ${row.name}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleOpenForView(row.raw);
                            }}
                          >
                            <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer rounded border-input"
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleFileSelected(row.id)}
                                aria-label={isSelected ? 'Unselect file' : 'Select file'}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <File className="w-4 h-4 text-muted-foreground" />
                                <div className="font-medium">{row.name || '—'}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">{row.mimeType || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{humanSize(row.size)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Cloud Storage Sections */}
            {connectedServices.map((service) => (
              <div key={service.name} className="border-t pt-4">
                <div className="px-4 pb-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>{service.icon}</span>
                    {service.label}
                  </h3>
                </div>
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Click "{service.label}" above to open in new tab
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4">
            {listItems.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                {searchTerm
                  ? 'No files found matching your search.'
                  : 'No files yet. Click "Add File" to get started.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {listItems.map((item: any) => {
                  if (item.type === 'folder') {
                    const isFolderSelected = selectedFolderPaths.includes(item.path);
                    return (
                      <div
                        key={`folder-${item.path}`}
                        className={`plugin-files relative rounded-lg border p-3 cursor-pointer transition-all ${
                          isFolderSelected ? 'bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50' : 'border-border hover:border-plugin-subtle hover:shadow-md'
                        }`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                          e.preventDefault();
                          setCurrentFolderPath(item.path);
                        }}
                      >
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer"
                            checked={isFolderSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleFolderSelected(item.path)}
                            aria-label={isFolderSelected ? 'Avmarkera mapp' : 'Markera mapp'}
                          />
                        </div>
                        <div className="mt-6 flex flex-col items-center text-center">
                          <div className="w-full h-24 flex items-center justify-center bg-muted rounded mb-2">
                            <Folder className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate w-full" title={item.label}>
                            {item.label}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">Mapp</div>
                        </div>
                      </div>
                    );
                  }
                  const row = item;
                  const isSelected = selectedFileIds.includes(row.id);
                  const FileIcon = getFileIcon(row.mimeType);
                  const isImage = row.mimeType?.startsWith('image/');
                  return (
                    <div
                      key={row.id}
                      className={`plugin-files relative rounded-lg border p-3 cursor-pointer transition-all ${isSelected
                        ? 'bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                        : 'border-border hover:border-plugin-subtle hover:shadow-md'
                        }`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenForView(row.raw);
                      }}
                    >
                      <div className="absolute top-2 left-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleFileSelected(row.id)}
                          aria-label={isSelected ? 'Unselect file' : 'Select file'}
                        />
                      </div>
                      <div className="mt-6 flex flex-col items-center text-center">
                        {isImage && row.url ? (
                          <img
                            src={row.url}
                            alt={row.name}
                            className="w-full h-24 object-cover rounded mb-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center bg-muted rounded mb-2">
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate w-full" title={row.name}>
                          {row.name || '—'}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">{humanSize(row.size)}</div>
                        <div className="mt-2 flex items-center justify-between w-full text-[10px] text-muted-foreground pt-2 border-t border-gray-100 dark:border-gray-800">
                          <span>{row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}</span>
                          <span className="font-mono">#{row.id}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-input"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-2">
                    Updated
                    <SortIcon field="updatedAt" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">
                    {searchTerm
                      ? 'No files found matching your search.'
                      : 'No files yet. Click "Add File" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                listItems.map((item: any) => {
                  if (item.type === 'folder') {
                    const isFolderSelected = selectedFolderPaths.includes(item.path);
                    return (
                      <TableRow
                        key={`folder-${item.path}`}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 ${isFolderSelected ? 'bg-plugin-subtle' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open folder ${item.label}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                          e.preventDefault();
                          setCurrentFolderPath(item.path);
                        }}
                      >
                        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-input"
                            checked={isFolderSelected}
                            onChange={() => toggleFolderSelected(item.path)}
                            aria-label={isFolderSelected ? 'Avmarkera mapp' : 'Markera mapp'}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-muted-foreground" />
                            <div className="font-medium">{item.label}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">Mapp</div>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    );
                  }
                  const row = item;
                  const isSelected = selectedFileIds.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      tabIndex={0}
                      data-list-item={JSON.stringify(row.raw)}
                      data-plugin-name="files"
                      role="button"
                      aria-label={`Open file ${row.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenForView(row.raw);
                      }}
                    >
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-input"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleFileSelected(row.id)}
                          aria-label={isSelected ? 'Unselect file' : 'Select file'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-muted-foreground" />
                          <div className="font-medium">{row.name || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{row.mimeType || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{humanSize(row.size)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete-modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Delete selected</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {[
                    selectedFileIds.length > 0 && `${selectedFileIds.length} file${selectedFileIds.length !== 1 ? 's' : ''}`,
                    selectedFolderPaths.length > 0 && `${selectedFolderPaths.length} folder${selectedFolderPaths.length !== 1 ? 's' : ''}`,
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  {selectedFolderPaths.length > 0
                    ? 'Deleting folders will remove all files inside them.'
                    : 'This will also remove the physical files.'}{' '}
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleting || (selectedFileIds.length === 0 && selectedFolderPaths.length === 0)}
                  onClick={runDeleteFlow}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Create folder */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skapa mapp</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {currentFolderPath ? `Mappen skapas i: ${currentFolderPath}` : 'Mappen skapas i root'}
          </p>
          <Input
            placeholder="Mappens namn"
            value={createFolderName}
            onChange={(e) => setCreateFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)} disabled={createFolderSaving}>
              Avbryt
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!createFolderName.trim() || createFolderSaving}
            >
              <FolderPlus className="h-4 w-4" />
              {createFolderSaving ? 'Skapar…' : createFolderAndMove ? 'Skapa och flytta' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new list (from Add to list) */}
      <Dialog open={showCreateListDialog} onOpenChange={setShowCreateListDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skapa ny lista</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedFileIds.length} fil{selectedFileIds.length !== 1 ? 'er' : ''} läggs i den nya listan.
          </p>
          <Input
            placeholder="Listans namn"
            value={createListDialogName}
            onChange={(e) => setCreateListDialogName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateListDialogSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateListDialog(false)} disabled={createListDialogSaving}>
              Avbryt
            </Button>
            <Button
              onClick={handleCreateListDialogSubmit}
              disabled={!createListDialogName.trim() || createListDialogSaving}
            >
              <Plus className="h-4 w-4" />
              {createListDialogSaving ? 'Skapar…' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloud Storage Settings Modal */}
      {showCloudSettings && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCloudSettings(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Cloud Storage Settings</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCloudSettings(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <CloudStorageSettings />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
