import React from 'react';

import { DetailSection } from '@/core/ui/DetailSection';

import { CloudStorageSettings } from './CloudStorageSettings';

interface FileSettingsFormProps {
  onCancel?: () => void;
}

export const FileSettingsForm: React.FC<FileSettingsFormProps> = ({ onCancel: _onCancel }) => {
  return (
    <div className="p-6 space-y-6">
      <DetailSection title="Cloud storage">
        <p className="text-sm text-muted-foreground mb-4">
          Connect your cloud storage accounts to access files directly from Homebase.
        </p>
        <CloudStorageSettings />
      </DetailSection>
    </div>
  );
};
