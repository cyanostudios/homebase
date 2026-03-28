// Pulse settings — card body (shell: title + close in PulseList, like Slots).

import React from 'react';

import { Card } from '@/components/ui/card';

import { usePulses } from '../hooks/usePulses';

import { PulseSettingsForm } from './PulseSettingsForm';

export function PulseSettingsView() {
  const { closePulseSettingsView } = usePulses();

  return (
    <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
      <PulseSettingsForm onCancel={closePulseSettingsView} onSaveSuccess={closePulseSettingsView} />
    </Card>
  );
}
