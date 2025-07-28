import React, { useState } from 'react';
import { useApp } from '@/core/api/AppContext';
import { useEstimates } from '../hooks/useEstimates';
import { Calendar, User, FileText, Calculator, Share, Copy, Check, Download, Copy as CopyIcon } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Estimate, calculateEstimateTotals } from '../types/estimate';
import { estimateShareApi, estimatesApi } from '../api/estimatesApi';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const { contacts } = useApp(); // Cross-plugin functions only
  const { saveEstimate, duplicateEstimate } = useEstimates(); // Use EstimateContext for updates

  // Share state
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // PDF state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  if (!estimate) return null;

  // Calculate totals from line items
  const totals = calculateEstimateTotals(estimate.lineItems || []);

  // Handle status change using EstimateContext
  const handleStatusChange = async (newStatus: string) => {
    try {
      // Create updated estimate data with new status
      const updatedData = {
        contactId: estimate.contactId,
        contactName: estimate.contactName,
        organizationNumber: estimate.organizationNumber,
        currency: estimate.currency,
        lineItems: estimate.lineItems,
        estimateDiscount: estimate.estimateDiscount || 0,
        notes: estimate.notes,
        validTo: estimate.validTo,
        status: newStatus, // Update the status
      };

      // Use EstimateContext's saveEstimate function for real updates
      const success = await saveEstimate(updatedData);
      
      if (success) {
        console.log(`Status successfully changed to ${newStatus}`);
        // The EstimateContext will handle updating the state and switching to view mode
      } else {
        console.error('Failed to update status');
        alert('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Handle duplicate using EstimateContext
  const handleDuplicate = async () => {
    try {
      await duplicateEstimate(estimate);
      // The duplicateEstimate function will create a new estimate and add it to the list
    } catch (error) {
      console.error('Failed to duplicate estimate:', error);
      alert('Failed to duplicate estimate. Please try again.');
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    console.log('📋 Downloading PDF for estimate:', {
      id: estimate.id,
      estimateNumber: estimate.estimateNumber,
      idType: typeof estimate.id
    });
    setIsDownloadingPDF(true);
    try {
      await estimatesApi.downloadPDF(estimate.id);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Handle share creation
  const handleCreateShare = async () => {
    try {
      setIsCreatingShare(true);
      
      // Create share with same expiration as estimate
      const share = await estimateShareApi.createShare({
        estimateId: estimate.id,
        validUntil: estimate.validTo,
      });

      // Generate and set the share URL
      const url = estimateShareApi.generateShareUrl(share.shareToken);
      setShareUrl(url);

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      
    } catch (error) {
      console.error('Failed to create share:', error);
      alert(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  // Handle copy share URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
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
                  Price
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disc
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAT
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sub
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  -Disc
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  +VAT
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
                    {(item.unitPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {(item.discount || 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {item.vatRate}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {(item.lineSubtotal || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    -{(item.discountAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {(item.vatAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {(item.lineTotal || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 🗑️ REMOVED: Share URL Display - flyttad till Quick Actions */}
      </Card>

      {/* Totals */}
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
              disabled={estimate.status === 'draft'}
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
              disabled={estimate.status === 'sent'}
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
              disabled={estimate.status === 'accepted'}
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
              disabled={estimate.status === 'rejected'}
            >
              Rejected
            </Button>
          </div>
        </div>

        {/* Other Actions */}
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Other Actions</div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="secondary" 
              size="sm"
              icon={Share}
              onClick={handleCreateShare}
              disabled={isCreatingShare}
            >
              {isCreatingShare ? 'Creating Share...' : 'Share Estimate'}
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={Download}
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
            >
              {isDownloadingPDF ? 'Generating PDF...' : 'Download PDF'}
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={CopyIcon}
              onClick={handleDuplicate}
            >
              Duplicate Estimate
            </Button>
            
            {estimate.status === 'accepted' && (
              <Button variant="primary" size="sm">
                Convert to Invoice
              </Button>
            )}
          </div>
        </div>

        {/* ✅ KEPT: Share URL Display - only in Quick Actions section */}
        {shareUrl && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-2">Share Link Created!</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-white rounded border text-sm font-mono break-all">
                {shareUrl}
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopyUrl}
                className={copied ? 'bg-green-100 text-green-700' : ''}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="text-xs text-blue-700 mt-2">
              This link expires on {new Date(estimate.validTo).toLocaleDateString()}
            </div>
          </div>
        )}
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