// Mail settings — card body (shell: title + close in MailList, like Slots).

import React from 'react';

import { Card } from '@/components/ui/card';

import { useMail } from '../hooks/useMail';

import { MailSettingsForm } from './MailSettingsForm';

export function MailSettingsView() {
  const { closeMailSettingsView } = useMail();

  return (
    <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
      <MailSettingsForm onCancel={closeMailSettingsView} onSaveSuccess={closeMailSettingsView} />
    </Card>
  );
}
