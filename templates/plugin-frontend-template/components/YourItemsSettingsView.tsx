import React from 'react';
import { useTranslation } from 'react-i18next';

import { DetailSection } from '@/core/ui/DetailSection';
import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

interface YourItemsSettingsViewProps {
  inlineTrailing?: React.ReactNode;
  onClose?: () => void;
}

export function YourItemsSettingsView({
  inlineTrailing,
  onClose,
}: YourItemsSettingsViewProps = {}) {
  const { t } = useTranslation();

  return (
    <PluginSettingsPageShell
      title="Plugin settings"
      subtitle="Configure plugin-specific options."
      categories={[]}
      trailing={inlineTrailing}
      onClose={onClose}
    >
      <DetailSection title={t('common.settings')} className="pt-0">
        <p className="text-sm text-muted-foreground">
          No layout settings in this template — list view is table-only. Add domain settings
          categories here when scaffolding a real plugin.
        </p>
      </DetailSection>
    </PluginSettingsPageShell>
  );
}
