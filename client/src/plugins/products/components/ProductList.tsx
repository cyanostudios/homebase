import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Phone, Edit, Trash2, Eye, Building, User, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { Button } from '@/core/ui/Button';
import { Badge } from '@/core/ui/Badge';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

// NOTE: Underlying fields (contactNumber/companyName/etc.) remain until real Product schema is defined
type SortField = 'contactNumber' | 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export const ProductList: React.FC = () => {
  const { products, openProductPanel, openProductForEdit, openProductForView, deleteProduct } = useProducts();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; productId: string; productName: string; }>({
    isOpen: false, productId: '', productName: ''
  });

  const [sortField, setSortField] = useState<SortField>('contactNumber');
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

  const sortedProducts = useMemo(() => {
    const filtered = products.filter((p: any) =>
      p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contactNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.organizationNumber && p.organizationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.personalNumber && p.personalNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return [...filtered].sort((a: any, b: any) => {
      let aValue: string;
      let bValue: string;
      if (sortField === 'name') { aValue = a.companyName.toLowerCase(); bValue = b.companyName.toLowerCase(); }
      else if (sortField === 'type') { aValue = a.contactType; bValue = b.contactType; }
      else { aValue = a.contactNumber; bValue = b.contactNumber; }
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [products, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, name: string) => setDeleteConfirm({ isOpen: true, productId: id, productName: name });
  const confirmDelete = () => { deleteProduct(deleteConfirm.productId); setDeleteConfirm({ isOpen: false, productId: '', productName: '' }); };
  const cancelDelete = () => setDeleteConfirm({ isOpen: false, productId: '', productName: '' });

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
              placeholder="Search products..."
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
                  onClick={() => handleSort('contactNumber')}
                >
                  <div className="flex items-center gap-1">
                    #
                    <SortIcon field="contactNumber" />
                  </div>
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
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    <SortIcon field="type" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email/Web</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No products found matching your search.' : 'No products yet. Click "Add Product" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product: any, idx: number) => (
                  <tr
                    key={product.id}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                    tabIndex={0}
                    data-list-item={JSON.stringify(product)}
                    data-plugin-name="products"
                    role="button"
                    aria-label={`Open product ${product.companyName}`}
                    onClick={(e) => { e.preventDefault(); handleOpenForView(product); }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-medium text-gray-900">#{product.contactNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {product.contactType === 'company' ? (<Building className="w-5 h-5" />) : (<User className="w-5 h-5" />)}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.companyName}</div>
                          {product.contactType === 'company' && product.organizationNumber && (
                            <div className="text-xs text-gray-500">{product.organizationNumber}</div>
                          )}
                          {product.contactType === 'private' && product.personalNumber && (
                            <div className="text-xs text-gray-500">{product.personalNumber.substring(0, 9)}XXXX</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={product.contactType === 'company' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {product.contactType === 'company' ? 'Company' : 'Private'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="text-sm text-gray-900">{product.email}</span>
                        {product.website && <div className="text-xs text-gray-500">{product.website}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{product.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={Eye}
                          onClick={(e) => { e.stopPropagation(); handleOpenForView(product); }}>
                          View
                        </Button>
                        <Button variant="secondary" size="sm" icon={Edit}
                          onClick={(e) => { e.stopPropagation(); handleOpenForEdit(product); }}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" icon={Trash2}
                          onClick={(e) => { e.stopPropagation(); handleDelete(product.id, product.companyName); }}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedProducts.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm ? 'No products found matching your search.' : 'No products yet. Click "Add Product" to get started.'}
              </div>
            ) : (
              sortedProducts.map((product: any) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs font-mono font-medium text-gray-600">#{product.contactNumber}</div>
                      {product.contactType === 'company' ? (
                        <Building className="w-4 h-4 text-blue-500" />
                      ) : (
                        <User className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <h3 className="text-sm font-medium text-gray-900">{product.companyName}</h3>
                      </div>
                      <div className="space-y-1">
                        {product.contactType === 'company' && product.organizationNumber && (
                          <div className="text-xs text-gray-500">{product.organizationNumber}</div>
                        )}
                        {product.contactType === 'private' && product.personalNumber && (
                          <div className="text-xs text-gray-500">{product.personalNumber.substring(0, 9)}XXXX</div>
                        )}
                        {product.email && <div className="text-xs text-gray-600">{product.email}</div>}
                        {product.website && <div className="text-xs text-gray-600">{product.website}</div>}
                        {product.phone && <div className="text-xs text-gray-600">{product.phone}</div>}
                      </div>
                    </div>
                    <div>
                      <Button variant="ghost" size="sm" icon={Eye} onClick={() => handleOpenForView(product)} className="h-8 px-3">
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

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteConfirm.productName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
