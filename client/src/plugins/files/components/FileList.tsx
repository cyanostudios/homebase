import { File } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { GroupedList } from '@/core/ui/GroupedList';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useFiles } from '../hooks/useFiles';

type SortField = 'name' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';

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

export const FileList: React.FC = () => {
  const { files, openFileForView } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField] = useState<SortField>('name');
  const [sortOrder] = useState<SortOrder>('asc');

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

  const handleOpenForView = (item: any) => attemptNavigation(() => openFileForView(item));
  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, id, or type"
      />

      <Card className="shadow-none">
        <GroupedList
          items={filteredAndSorted}
          groupConfig={null}
          emptyMessage="No files found."
          renderItem={(row, idx) => (
            <div
              key={row.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
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
              {/* Rad 1: Icon + File Name */}
              <div className="flex items-center gap-2 mb-1.5">
                <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {row.name || '—'}
                </div>
              </div>

              {/* Rad 2: Type + Size + Updated */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="truncate">{row.mimeType || '—'}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span>{humanSize(row.size)}</span>
                  {row.updatedAt && (
                    <>
                      <span>•</span>
                      <span>Updated {row.updatedAt.toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
};
