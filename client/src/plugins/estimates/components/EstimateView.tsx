import React from 'react';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Estimate, calculateEstimateTotals } from '../types/estimate';
import { StatusReasonModal } from './StatusReasonModal';
import { EstimateStatusButtons } from './EstimateStatusButtons';
import { EstimateActions } from './EstimateActions';
import { useEstimateStatusActions } from '../hooks/useEstimateStatusActions';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const {
    showStatusModal,
    showSentConfirmation,
    pendingStatus,
    handleStatusChange,
    handleSentConfirm,
    handleSentCancel,
    handleModalConfirm,
    handleModalCancel,
  } = useEstimateStatusActions();

  if (!estimate) return null;

  // Calculate totals from line items
  const totals = calculateEstimateTotals(estimate.lineItems || []);

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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disc %</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">VAT %</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">-Disc</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">+VAT</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {estimate.lineItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.description}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{(item.discount || 0).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{item.vatRate}%</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">-{(item.discountAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{(item.vatAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{(item.lineTotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Summary</Heading>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="text-sm font-medium text-gray-900">{totals.subtotal.toFixed(2)} {estimate.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Discount:</span>
            <span className="text-sm font-medium text-gray-900">-{totals.totalDiscount.toFixed(2)} {estimate.currency}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3">
            <span className="text-sm text-gray-600">Subtotal after discount:</span>
            <span className="text-sm font-medium text-gray-900">{totals.subtotalAfterDiscount.toFixed(2)} {estimate.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total VAT:</span>
            <span className="text-sm font-medium text-gray-900">{totals.totalVat.toFixed(2)} {estimate.currency}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-3">
            <span>Total:</span>
            <span>{totals.total.toFixed(2)} {estimate.currency}</span>
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
        <EstimateStatusButtons 
          estimate={estimate} 
          onStatusChange={(status) => handleStatusChange(estimate, status)} 
        />

        {/* Other Actions */}
        <EstimateActions estimate={estimate} />
      </Card>

      <hr className="border-gray-100" />

{/* Metadata */}
<Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Estimate Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{estimate.id}</div>
          </div>
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

      {/* Status Reason Modal */}
      <StatusReasonModal
        isOpen={showStatusModal}
        onClose={handleModalCancel}
        onConfirm={(reasons) => handleModalConfirm(estimate, reasons)}
        status={pendingStatus || 'accepted'}
        estimateNumber={estimate.estimateNumber}
      />

      {/* Sent Confirmation Dialog */}
      {showSentConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Mark estimate as sent?</h2>
                <p className="text-xs text-gray-500">Estimate {estimate.estimateNumber}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                This will change the status to "Sent" and indicate that the estimate has been delivered to the customer.
              </p>
              <p className="text-xs text-gray-500 italic">
                You can change it back to "Draft" at any time if needed.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSentCancel}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSentConfirm(estimate)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Mark as Sent
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}