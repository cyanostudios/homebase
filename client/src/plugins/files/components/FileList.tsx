import {
  File,
  Trash2,
  Grid3x3,
  List,
  ChevronUp,
  ChevronDown,
  Cloud,
  Settings,
  X,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';

import { Card } from '@/components/ui/card';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { Heading } from '@/core/ui/Typography';
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
  if (!mimeType) {
    return File;
  }
  if (mimeType.startsWith('image/')) {
    return File;
  } // Could use Image icon
  if (mimeType.includes('pdf')) {
    return File;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return File;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return File;
  }
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
    selectedCount,
    // Bulk delete
    deleteFiles,
  } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();

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
    if (!headerCheckboxRef.current) {
      return;
    }
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
    if (sortField !== field) {
      return null;
    }
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

  // Set header trailing (search + view mode toggle) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, id, or type..."
        rightActions={
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md border text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md border text-sm ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing]);

  const handleOpenForView = (item: any) => attemptNavigation(() => openFileForView(item));

  const runDeleteFlow = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds);
      setShowDeleteModal(false);
      // clearFileSelection is called automatically by deleteFiles
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      // Error is already handled in context
    } finally {
      setDeleting(false);
    }
  };

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
    cloudStorageSettings.googledrive?.connected && {
      name: 'googledrive',
      label: 'Google Drive',
      icon: '☁️',
    },
  ].filter(Boolean) as Array<{ name: string; label: string; icon: string }>;

  return (
    <div className="space-y-4">
      {/* Cloud Storage Info */}
      {connectedServices.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600">Cloud storage:</span>
          {connectedServices.map((service) => (
            <button
              key={service.name}
              onClick={() => handleOpenCloudStorage(service.name as any)}
              disabled={openingCloudService === service.name}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              title={`Open ${service.label}`}
            >
              <span>{service.icon}</span>
              <span>{service.label}</span>
              {openingCloudService === service.name && <span className="animate-pulse">...</span>}
            </button>
          ))}
          <button
            onClick={() => setShowCloudSettings(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
            title="Manage cloud storage"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </button>
        </div>
      )}
      {connectedServices.length === 0 && (
        <div>
          <button
            onClick={() => setShowCloudSettings(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Cloud className="w-3 h-3" />
            <span>Connect cloud storage</span>
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearFileSelection}
        actions={[
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setShowDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card>
        {viewMode === 'grid' ? (
          <div className="p-4">
            {filteredAndSorted.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
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
                        <div
                          className="text-xs font-medium text-gray-900 truncate w-full"
                          title={row.name}
                        >
                          {row.name || '—'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{humanSize(row.size)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-1">
                    Updated
                    <SortIcon field="updatedAt" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm
                      ? 'No files found matching your search.'
                      : 'No files yet. Click "Add File" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((row: any, idx: number) => {
                  const isSelected = selectedFileIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
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
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleFileSelected(row.id)}
                          aria-label={isSelected ? 'Unselect file' : 'Select file'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">{row.name || '—'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{row.mimeType || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{humanSize(row.size)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={runDeleteFlow}
        itemCount={selectedCount}
        itemLabel="files"
        isLoading={deleting}
        warningMessage="This will also remove the physical files."
      />

      {/* Cloud Storage Settings Modal */}
      {showCloudSettings && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCloudSettings(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <Heading level={3} className="mb-0">
                  Cloud Storage Settings
                </Heading>
                <button
                  onClick={() => setShowCloudSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CloudStorageSettings />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
