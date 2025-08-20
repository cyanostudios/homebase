import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Eye, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { Button } from '@/core/ui/Button';
import { Badge } from '@/core/ui/Badge';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

type SortField = 'productNumber' | 'title' | 'status' | 'quantity' | 'price' | 'sku';
type SortOrder = 'asc' | 'desc';

const statusClass = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'for sale') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'archived') return 'bg-gray-100 text-gray-700';
  return 'bg-blue-100 text-blue-800';
};

export const ProductList: React.FC = () => {
  const { products, openProductPanel, openProductForEdit, openProductForView } = useProducts();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('productNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const normalize = (p: any) => ({
    id: p.id,
    productNumber: p.productNumber || '',
    title: p.title || '',
    status: p.status || 'for sale',
    quantity: Number.isFinite(p.quantity) ? p.quantity : 0,
    priceAmount: Number.isFinite(p.priceAmount) ? p.priceAmount : 0,
    currency: p.currency || 'SEK',
    sku: p.sku || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    raw: p
  });

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const filtered = products
      .map(normalize)
      .filter((p: any) => {
        if (!needle) return true;
        return (
          p.title.toLowerCase().includes(needle) ||
          String(p.productNumber).toLowerCase().includes(needle) ||
          String(p.sku).toLowerCase().includes(needle)
        );
      });

    const cmp = (a: any, b: any) => {
      let av: string | number = '';
      let bv: string | number = '';

      switch (sortField) {
        case 'title':
          av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case 'status':
          av = a.status.toLowerCase(); bv = b.status.toLowerCase(); break;
        case 'quantity':
          av = a.quantity; bv = b.quantity; break;
        case 'price':
          av = a.priceAmount; bv = b.priceAmount; break;
        case 'sku':
          av = (a.sku || '').toLowerCase(); bv = (b.sku || '').toLowerCase(); break;
        case 'productNumber':
        default:
          av = String(a.productNumber).toLowerCase();
          bv = String(b.productNumber).toLowerCase();
          break;
      }

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const res = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [products, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // Protected navigation handlers
  const handleOpenForView = (product: any) => attemptNavigation(() => openProductForView(product));
  const handleOpenForEdit = (product: any) => attemptNavigation(() => openProductForEdit(product));
  const handleOpenPanel = () => attemptNavigation(() => openProductPanel(null));

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Products</Heading>
          <Text variant="caption">Manage your product catalog</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by title, SKU or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>Add Product</Button>
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
                  onClick={() => handleSort('productNumber')}
                >
                  <div className="flex items-center gap-1">
                    #
                    <SortIcon field="productNumber" />
                  </div>
                </th>
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
                  onClick={() => handleSort('sku')}
                >
                  <div className="flex items-center gap-1">
                    SKU
                    <SortIcon field="sku" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-1">
                    Qty
                    <SortIcon field="quantity" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center gap-1">
                    Price
                    <SortIcon field="price" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No products found matching your search.' : 'No products yet. Click "Add Product" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((p: any, idx: number) => {
                  const raw = p.raw;
                  return (
                    <tr
                      key={p.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                      tabIndex={0}
                      data-list-item={JSON.stringify(raw)}
                      data-plugin-name="products"
                      role="button"
                      aria-label={`Open product ${p.title}`}
                      onClick={(e) => { e.preventDefault(); handleOpenForView(raw); }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium text-gray-900">#{p.productNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{p.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-700">{p.sku || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={statusClass(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{p.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {p.priceAmount?.toFixed ? p.priceAmount.toFixed(2) : Number(p.priceAmount || 0).toFixed(2)} {p.currency}
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
                {searchTerm ? 'No products found matching your search.' : 'No products yet. Click "Add Product" to get started.'}
              </div>
            ) : (
              filteredAndSorted.map((p: any) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">{p.title}</h3>
                      <div className="mt-1 space-y-1">
                        <div className="text-xs text-gray-600">#{p.productNumber} · {p.sku || '—'}</div>
                        <div className="text-xs text-gray-600">
                          {p.priceAmount?.toFixed ? p.priceAmount.toFixed(2) : Number(p.priceAmount || 0).toFixed(2)} {p.currency}
                        </div>
                        <div>
                          <Badge className={statusClass(p.status)}>{p.status}</Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="ghost" size="sm" icon={Eye}
                        onClick={() => handleOpenForView(p.raw)} className="h-8 px-3">
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
