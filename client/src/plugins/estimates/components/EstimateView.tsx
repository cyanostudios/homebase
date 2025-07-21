import React from 'react';
import { useApp } from '@/core/api/AppContext';
import { Calendar, User, FileText, Calculator } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Estimate } from '../types/estimate';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const { contacts } = useApp(); // Cross-plugin functions only

  if (!estimate) return null;

  // Handle status change - this would typically call an API or update function
  const handleStatusChange = async (newStatus: string) => {
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll just log it as a mockup
      console.log(`Changing estimate ${estimate.id} status from ${estimate.status} to ${newStatus}`);
      
      // This would typically be:
      // await updateEstimateStatus(estimate.id, newStatus);
      // Then refresh the data or update the local state
      
      // For now, show user feedback
      alert(`Status changed to ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isValidToExpired = new Date(estimate.validTo) < new Date();

  return (
    <div className="space-y-4">
      {/* Line Items */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Line Items ({estimate.lineItems.length})
        </Heading>
        
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
                    {item.unitPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {item.vatRate}%
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {item.lineSubtotal.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {item.vatAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {item.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Totals */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Summary</Heading>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="text-sm font-medium text-gray-900">{estimate.subtotal.toFixed(2)} {estimate.currency}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total VAT:</span>
            <span className="text-sm font-medium text-gray-900">{estimate.totalVat.toFixed(2)} {estimate.currency}</span>
          </div>
          
          <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-3">
            <span>Total:</span>
            <span>{estimate.total.toFixed(2)} {estimate.currency}</span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {estimate.notes && (
        <>
          <hr className="border-gray-100" />
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Notes</Heading>
            <div className="text-sm text-gray-900 whitespace-pre-wrap">{estimate.notes}</div>
          </Card>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Quick Actions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</Heading>
        
        {/* Status Actions */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Change Status</div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={estimate.status === 'draft' ? 'secondary' : 'ghost'} 
              size="sm"
              className={estimate.status === 'draft' 
                ? 'bg-gray-100 text-gray-800 ring-2 ring-gray-300' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }
              onClick={() => handleStatusChange('draft')}
            >
              Draft
            </Button>
            <Button 
              variant={estimate.status === 'sent' ? 'primary' : 'ghost'} 
              size="sm"
              className={estimate.status === 'sent' 
                ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }
              onClick={() => handleStatusChange('sent')}
            >
              Sent
            </Button>
            <Button 
              variant={estimate.status === 'accepted' ? 'primary' : 'ghost'} 
              size="sm"
              className={estimate.status === 'accepted' 
                ? 'bg-green-500 text-white ring-2 ring-green-300' 
                : 'bg-green-50 text-green-700 hover:bg-green-100'
              }
              onClick={() => handleStatusChange('accepted')}
            >
              Accepted
            </Button>
            <Button 
              variant={estimate.status === 'rejected' ? 'danger' : 'ghost'} 
              size="sm"
              className={estimate.status === 'rejected' 
                ? 'bg-red-500 text-white ring-2 ring-red-300' 
                : 'bg-red-50 text-red-700 hover:bg-red-100'
              }
              onClick={() => handleStatusChange('rejected')}
            >
              Rejected
            </Button>
          </div>
        </div>

        {/* Other Actions */}
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Other Actions</div>
          <div className="flex flex-wrap gap-3">
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

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Estimate Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(estimate.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(estimate.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}