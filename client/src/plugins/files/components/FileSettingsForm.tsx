import React from 'react';

import { CloudStorageSettings } from './CloudStorageSettings';

interface FileSettingsFormProps {
  onCancel?: () => void;
}

export const FileSettingsForm: React.FC<FileSettingsFormProps> = ({ onCancel: _onCancel }) => {
  return (
    <div className="plugin-files space-y-6 p-4">
      <CloudStorageSettings />
    </div>
  );
};
