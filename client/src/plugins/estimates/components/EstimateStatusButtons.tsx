import React from 'react';
import { Button } from '@/core/ui/Button';
import { Estimate } from '../types/estimate';

interface EstimateStatusButtonsProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}

export function EstimateStatusButtons({ estimate, onStatusChange }: EstimateStatusButtonsProps) {
  return (
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
          onClick={() => onStatusChange('draft')}
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
          onClick={() => onStatusChange('sent')}
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
          onClick={() => onStatusChange('accepted')}
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
          onClick={() => onStatusChange('rejected')}
          disabled={estimate.status === 'rejected'}
        >
          Rejected
        </Button>
      </div>
    </div>
  );
}