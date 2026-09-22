import React from 'react';

import { CloudStorageSettings } from './CloudStorageSettings';

export const FileSettingsForm: React.FC = () => {
  return (
    <div className="plugin-files space-y-6">
      <CloudStorageSettings />
    </div>
  );
};
