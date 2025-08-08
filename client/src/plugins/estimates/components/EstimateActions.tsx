import React, { useState, useEffect } from 'react';
import { Share, Copy, Check, Download, Copy as CopyIcon, X } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { Estimate, EstimateShare } from '../types/estimate';
import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';

interface EstimateActionsProps {
  estimate: Estimate;
}

export function EstimateActions({ estimate }: EstimateActionsProps) {
  const { duplicateEstimate } = useEstimates();
  
  // Share state
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [existingShare, setExistingShare] = useState<EstimateShare | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  
  // PDF state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Load existing share when component mounts
  useEffect(() => {
    loadExistingShare();
  }, [estimate.id]);

  const loadExistingShare = async () => {
    try {
      const shares = await estimateShareApi.getShares(estimate.id);
      // Get the most recent active share (not expired)
      const activeShare = shares.find(share => 
        new Date(share.validUntil) > new Date()
      );
      setExistingShare(activeShare || null);
    } catch (error) {
      console.error('Failed to load existing shares:', error);
    }
  };

  // Handle duplicate
  const handleDuplicate = async () => {
    try {
      await duplicateEstimate(estimate);
    } catch (error) {
      console.error('Failed to duplicate estimate:', error);
      alert('Failed to duplicate estimate. Please try again.');
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
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
    // Check if estimate is expired
    if (new Date(estimate.validTo) <= new Date()) {
      setShowExpiredModal(true);
      return;
    }

    try {
      setIsCreatingShare(true);
      
      const share = await estimateShareApi.createShare({
        estimateId: estimate.id,
        validUntil: estimate.validTo,
      });

      setExistingShare(share);

      const url = estimateShareApi.generateShareUrl(share.shareToken);
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
    if (!existingShare) return;
    
    try {
      const url = estimateShareApi.generateShareUrl(existingShare.shareToken);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Handle revoke share
  const handleRevokeShare = async () => {
    if (!existingShare) return;
    
    try {
      await estimateShareApi.revokeShare(existingShare.id);
      setExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share link');
    }
  };

  const shareUrl = existingShare ? estimateShareApi.generateShareUrl(existingShare.shareToken) : '';
  const isShareExpired = existingShare ? new Date(existingShare.validUntil) <= new Date() : false;

  return (
    <>
      {/* Other Actions */}
      <div>
        <div className="text-xs font-medium text-gray-700 mb-2">Other Actions</div>
        <div className="flex flex-wrap gap-3">
          {!existingShare && (
            <Button 
              variant="secondary" 
              size="sm"
              icon={Share}
              onClick={handleCreateShare}
              disabled={isCreatingShare}
            >
              {isCreatingShare ? 'Creating Share...' : 'Share Estimate'}
            </Button>
          )}
          
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

{/* Share URL Display */}
{existingShare && (
  <div className={`mt-4 p-4 rounded-lg border ${
    isShareExpired 
      ? 'bg-red-50 border-red-200' 
      : 'bg-blue-50 border-blue-200'
  }`}>
    <div className={`text-sm font-medium mb-2 ${
      isShareExpired ? 'text-red-900' : 'text-blue-900'
    }`}>
      {isShareExpired ? 'Share Link Expired' : 'Active Share Link'}
    </div>
    
    <div className="flex items-center gap-2 mb-2">
      <div className="flex-1 p-2 bg-white rounded border text-sm font-mono break-all">
        {shareUrl}
      </div>
      {!isShareExpired && (
        <Button 
          variant="secondary" 
          size="sm"
          icon={copied ? Check : Copy}
          onClick={handleCopyUrl}
          className={copied ? 'bg-green-100 text-green-700' : ''}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      )}
    </div>

    
    <div className={`text-xs ${
  isShareExpired ? 'text-red-700' : 'text-blue-700'
}`}>
  <div className="flex items-center justify-left">
    <div>
      {isShareExpired ? 'Expired on' : 'Expires on'} {new Date(existingShare.validUntil).toLocaleDateString()}
      {existingShare.accessedCount > 0 && (
        <span className="ml-2">• Accessed {existingShare.accessedCount} times</span>
      )}
    </div>
    <button 
      onClick={handleRevokeShare}
      className="text-red-600 hover:text-red-800 text-xs underline ml-4"
    >
      Revoke
    </button>
  </div>


      </div>
      </div>
      )}

      {/* Expired Date Modal */}
      {showExpiredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Cannot create share link</h2>
                <p className="text-xs text-gray-500">Estimate {estimate.estimateNumber}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                This estimate expired on {new Date(estimate.validTo).toLocaleDateString()}. Share links can only be created for estimates that are still valid.
              </p>
              <p className="text-xs text-gray-500 italic">
                Update the "Valid To" date in edit mode to create a share link.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowExpiredModal(false)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Got it!
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}