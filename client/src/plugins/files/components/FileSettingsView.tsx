// Files settings — card body (shell: title + close in FileList, like Mail).

import React from 'react';

import { Card } from '@/components/ui/card';

import { FileSettingsForm } from './FileSettingsForm';

export function FileSettingsView() {
  return (
    <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
      <FileSettingsForm />
    </Card>
  );
}
