import { File, Trash2, Grid3x3, List, ChevronUp, ChevronDown, Cloud, Settings, X } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';

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
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useFiles } from '../hooks/useFiles';
import { CloudStorageSettings } from './CloudStorageSettings';

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
  if (mimeType.startsWith('image/')) return File; // Could use Image icon
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
    // Selection API
    selectedFileIds,
    toggleFileSelected,
    selectAllFiles,
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

  const normalized = (it: any) => ({
    id: String(it.id ?? ''),
    name: String(it.name ?? ''),
    mimeType: it.mimeType ? String(it.mimeType) : '',
    size: typeof it.size === 'number' ? it.size : null,
    updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
    url: it.url ? String(it.url) : '',
    raw: it,
  });

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

  // Selected files (actual objects)
  const selectedFiles = useMemo(() => {
    const set = new Set(selectedFileIds.map(String));
    return files.filter((f: any) => set.has(String(f?.id)));
  }, [files, selectedFileIds]);

  // Selection helpers
  const visibleIds = useMemo(
    () => filteredAndSorted.map((f: any) => String(f.id)),
    [filteredAndSorted],
  );
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedFileIds.includes(id)),
    [visibleIds, selectedFileIds],
  );
  const someVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedFileIds.includes(id)),
    [visibleIds, selectedFileIds],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = () => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedFileIds.filter((id) => !set.has(id));
      selectAllFiles(remaining);
    } else {
      const union = Array.from(new Set([...selectedFileIds, ...visibleIds]));
      selectAllFiles(union);
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
    if (selectedFileIds.length === 0) return;
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds);
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

  const handleOpenCloudStorage = async (service: 'onedrive' | 'dropbox' | 'googledrive') => {
    setOpeningCloudService(service);
    try {
      const embedUrl = await getCloudStorageEmbedUrl(service);
      if (embedUrl) {
        window.open(embedUrl, '_blank', 'width=1200,height=800');
      }
    } catch (err) {
      console.error(`Failed to open ${service}:`, err);
      alert(`Failed to open ${service} file manager`);
    } finally {
      setOpeningCloudService(null);
    }
  };

  const connectedServices = [
    cloudStorageSettings.onedrive?.connected && { name: 'onedrive', label: 'OneDrive', icon: '📁' },
    cloudStorageSettings.dropbox?.connected && { name: 'dropbox', label: 'Dropbox', icon: '📦' },
    cloudStorageSettings.googledrive?.connected && { name: 'googledrive', label: 'Google Drive', icon: '☁️' },
  ].filter(Boolean) as Array<{ name: string; label: string; icon: string }>;

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <Button
        variant={viewMode === 'grid' ? 'default' : 'outline'}
        size="sm"
        icon={Grid3x3}
        onClick={() => setViewMode('grid')}
        title="Grid view"
      />
      <Button
        variant={viewMode === 'list' ? 'default' : 'outline'}
        size="sm"
        icon={List}
        onClick={() => setViewMode('list')}
        title="List view"
      />
      {selectedFileIds.length > 0 && (
        <Button
          variant="destructive"
          size="sm"
          icon={Trash2}
          onClick={() => setShowDeleteModal(true)}
        >
          Delete {selectedFileIds.length}
        </Button>
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
          {connectedServices.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Cloud storage:</span>
              {connectedServices.map((service) => (
                <Button
                  key={service.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenCloudStorage(service.name as any)}
                  disabled={openingCloudService === service.name}
                  title={`Open ${service.label}`}
                >
                  <span>{service.icon}</span>
                  <span>{service.label}</span>
                  {openingCloudService === service.name && <span className="animate-pulse">...</span>}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                icon={Settings}
                onClick={() => setShowCloudSettings(true)}
                title="Manage cloud storage"
              >
                Settings
              </Button>
            </div>
          )}
          {connectedServices.length === 0 && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                icon={Cloud}
                onClick={() => setShowCloudSettings(true)}
              >
                Connect cloud storage
              </Button>
            </div>
          )}
          {selectedFileIds.length > 0 && (
            <div className="mt-2 text-sm flex items-center flex-wrap gap-2">
              <Badge variant="secondary">{selectedFileIds.length} selected</Badge>
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

      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, id, or type..."
        rightActions={toolbarActions}
      />

      <Card className="shadow-none">
        {viewMode === 'grid' ? (
          <div className="p-4">
            {filteredAndSorted.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                {searchTerm
                  ? 'No files found matching your search.'
                  : 'No files yet. Click "Add File" to get started.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredAndSorted.map((row: any) => {
                  const isSelected = selectedFileIds.includes(row.id);
                  const FileIcon = getFileIcon(row.mimeType);
                  const isImage = row.mimeType?.startsWith('image/');
                  return (
                    <div
                      key={row.id}
                      className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenForView(row.raw);
                      }}
                    >
                      <div className="absolute top-2 left-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
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
                          <div className="w-full h-24 flex items-center justify-center bg-gray-100 rounded mb-2">
                            <FileIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="text-xs font-medium text-gray-900 truncate w-full" title={row.name}>
                          {row.name || '—'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {humanSize(row.size)}
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
                    className="rounded border-input"
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
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">
                    {searchTerm
                      ? 'No files found matching your search.'
                      : 'No files yet. Click "Add File" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((row: any) => {
                  const isSelected = selectedFileIds.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-input"
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
                <h3 className="text-lg font-semibold">Delete selected files</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFiles.length} files selected
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}? 
                  This will also remove the physical files. This action cannot be undone.
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
                  disabled={deleting || selectedFiles.length === 0}
                  onClick={runDeleteFlow}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

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
