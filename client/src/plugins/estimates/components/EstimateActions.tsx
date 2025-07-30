import React, { useState } from 'react';
import { Share, Copy, Check, Download, Copy as CopyIcon } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { Estimate } from '../types/estimate';
import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';

interface EstimateActionsProps {
  estimate: Estimate;
}

export function EstimateActions({ estimate }: EstimateActionsProps) {
  const { duplicateEstimate } = useEstimates();
  
  // Share state
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // PDF state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

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
    try {
      setIsCreatingShare(true);
      
      const share = await estimateShareApi.createShare({
        estimateId: estimate.id,
        validUntil: estimate.validTo,
      });

      const url = estimateShareApi.generateShareUrl(share.shareToken);
      setShareUrl(url);

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

  return (
    <>
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

      {/* Share URL Display */}
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
    </>
  );
}