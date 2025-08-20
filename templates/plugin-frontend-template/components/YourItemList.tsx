// templates/plugin-frontend-template/components/YourItemList.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Eye, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useYourItems } from '../hooks/useYourItems';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

type SortField = 'title' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';

export const YourItemList: React.FC = () => {
  const { yourItems, openYourItemsPanel, openYourItemForEdit, openYourItemForView } = useYourItems();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
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
    title: String(it.title ?? ''),
    updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
    raw: it,
  });

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = yourItems
      .map(normalized)
      .filter((it) => {
        if (!needle) return true;
        return it.title.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle);
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
        case 'title':
        default:
          av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
      }
      if (typeof av === 'number' && typeof bv === 'number') return sortOrder === 'asc' ? av - bv : bv - av;
      const res = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [yourItems, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const handleOpenForView = (item: any) => attemptNavigation(() => openYourItemForView(item));
  const handleOpenForEdit = (item: any) => attemptNavigation(() => openYourItemForEdit(item));
  const handleOpenPanel = () => attemptNavigation(() => openYourItemsPanel(null));

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Your Items</Heading>
          <Text variant="caption">Template list</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by title or id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>Add Item</Button>
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
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Title
                    <SortIcon field="title" />
                  </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No items match your search.' : 'No items yet. Click "Add Item" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((it: any, idx: number) => {
                  const raw = it.raw;
                  return (
                    <tr
                      key={it.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                      tabIndex={0}
                      data-list-item={JSON.stringify(raw)}
                      data-plugin-name="your-items"
                      role="button"
                      aria-label={`Open item ${it.title || it.id}`}
                      onClick={(e) => { e.preventDefault(); handleOpenForView(raw); }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{it.title || '—'}</div>
                        <div className="text-xs text-gray-500">{it.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {it.updatedAt ? it.updatedAt.toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost" size="sm" icon={Eye}
                            onClick={(e) => { e.stopPropagation(); handleOpenForView(raw); }}>
                            View
                          </Button>
                          <Button
                            variant="secondary" size="sm" icon={Edit}
                            onClick={(e) => { e.stopPropagation(); handleOpenForEdit(raw); }}>
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm ? 'No items match your search.' : 'No items yet. Click "Add Item" to get started.'}
              </div>
            ) : (
              filteredAndSorted.map((it: any) => (
                <div key={it.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">{it.title || '—'}</h3>
                      <div className="mt-1 space-y-1">
                        <div className="text-xs text-gray-600">{it.id}</div>
                        <div className="text-xs text-gray-600">{it.updatedAt ? it.updatedAt.toLocaleString() : '—'}</div>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="ghost" size="sm" icon={Eye}
                        onClick={() => handleOpenForView(it.raw)} className="h-8 px-3">
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
