import React from 'react';
import { useApp } from '@/core/api/AppContext';
import { Calendar, User, FileText, Calculator } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Estimate } from '../types/estimate';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const { openContactForView, contacts } = useApp(); // Cross-plugin functions only

  if (!estimate) return null;

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colorClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleViewContact = () => {
    if (estimate.contactId) {
      const contact = contacts.find(c => c.id === estimate.contactId);
      if (contact) {
        openContactForView(contact);
      }
    }
  };

  const isValidToExpired = new Date(estimate.validTo) < new Date();

  return (
    <div className="p-6 space-y-6">


      {/* Line Items */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Line Items ({estimate.lineItems.length})
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAT %
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAT
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {estimate.lineItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.description}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.unitPrice.toFixed(2)} {estimate.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.vatRate}%
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.lineSubtotal.toFixed(2)} {estimate.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.vatAmount.toFixed(2)} {estimate.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {item.lineTotal.toFixed(2)} {estimate.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Totals */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{estimate.subtotal.toFixed(2)} {estimate.currency}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Total VAT:</span>
              <span className="font-medium">{estimate.totalVat.toFixed(2)} {estimate.currency}</span>
            </div>
            
            <div className="flex justify-between text-xl font-semibold border-t border-gray-200 pt-3">
              <span>Total:</span>
              <span>{estimate.total.toFixed(2)} {estimate.currency}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {estimate.notes && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{estimate.notes}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            
            {estimate.status === 'draft' && (
              <Button variant="primary" size="sm">
                Mark as Sent
              </Button>
            )}
            
            {estimate.status === 'sent' && (
              <>
                <Button variant="success" size="sm">
                  Mark as Accepted
                </Button>
                <Button variant="danger" size="sm">
                  Mark as Rejected
                </Button>
              </>
            )}
            
            <Button variant="secondary" size="sm">
              Download PDF
            </Button>
            
            <Button variant="secondary" size="sm">
              Duplicate Estimate
            </Button>
            
            {estimate.status === 'accepted' && (
              <Button variant="primary" size="sm">
                Convert to Invoice
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Status History - Future enhancement */}
      {false && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Status History</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Created as Draft</span>
                <span className="text-gray-500">{new Date(estimate.createdAt).toLocaleDateString()}</span>
              </div>
              {/* Future: Add status change history */}
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}