import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Eye, ChevronUp, ChevronDown, Search, Trash2, Download } from 'lucide-react';
import { useFiles } from '../hooks/useFiles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

type SortField = 'name' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';

function humanSize(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export const FileList: React.FC = () => {
  const { files, openFilesPanel, openFileForEdit, openFileForView, deleteFile } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
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

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = files
      .map(normalized)
      .filter((it) => {
        if (!needle) return true;
        return (
          it.name.toLowerCase().includes(needle) ||
          it.id.toLowerCase().includes(needle) ||
          it.mimeType.toLowerCase().includes(needle)
        );
      });

    const cmp = (a: any, b: any) => {
      let av: any; let bv: any;
      switch (sortField) {
        case 'updatedAt':
          av = a.updatedAt ? a.updatedAt.getTime() : 0;
          bv = b.updatedAt ? b.updatedAt.getTime() : 0;
          break;
        case 'id':
          av = a.id.toLowerCase(); bv = b.id.toLowerCase(); break;
        case 'name':
        default:
          av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      }
      if (typeof av === 'number' && typeof bv === 'number') return sortOrder === 'asc' ? av - bv : bv - av;
      const res = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [files, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const handleOpenForView = (item: any) => attemptNavigation(() => openFileForView(item));
  const handleOpenForEdit = (item: any) => attemptNavigation(() => openFileForEdit(item));
  const handleOpenPanel = () => attemptNavigation(() => openFilesPanel(null));

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Files ({searchTerm ? filteredAndSorted.length : files.length}
            {searchTerm && filteredAndSorted.length !== files.length && ` of ${files.length}`})
          </Heading>
          <Text variant="caption">Template-based file manager list.</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, id, or type"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>Add File</Button>
          </div>
        </div>
      </div>

      <Card>
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
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
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSorted.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{row.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.mimeType || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {humanSize(row.size)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" icon={Eye} onClick={() => handleOpenForView(row.raw)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" icon={Edit} onClick={() => handleOpenForEdit(row.raw)}>
                        Edit
                      </Button>

                      {row.url ? (
                        <a
                          href={row.url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                          title="Download"
                        >
                          <Download className="w-4 h-4 mr-1" /> Download
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="No URL available"
                          className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed"
                        >
                          <Download className="w-4 h-4 mr-1" /> Download
                        </button>
                      )}

                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => deleteFile(row.id)}
                        title="Delete"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No files found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAndSorted.map((row) => (
              <div key={row.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">{row.name || '—'}</div>
                  <div className="text-xs text-gray-500">{row.mimeType || '—'}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'} • {humanSize(row.size)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleOpenForView(row.raw)}>
                    View
                  </Button>
                  <Button size="sm" variant="secondary" icon={Edit} onClick={() => handleOpenForEdit(row.raw)}>
                    Edit
                  </Button>

                  {row.url ? (
                    <a
                      href={row.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                      title="Download"
                    >
                      <Download className="w-4 h-4 mr-1" /> Download
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="No URL available"
                      className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed"
                    >
                      <Download className="w-4 h-4 mr-1" /> Download
                    </button>
                  )}

                  <Button size="sm" variant="danger" icon={Trash2} onClick={() => deleteFile(row.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {filteredAndSorted.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No files found.</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
