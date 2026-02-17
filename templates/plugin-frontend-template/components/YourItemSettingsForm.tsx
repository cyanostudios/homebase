// Optional: when your plugin has a settings screen, render it here.
// Use DetailSection to group settings. Close/Save in the panel footer
// work via the same submit/cancel events as the main form (see YourItemForm).
import React from 'react';
import { DetailSection } from '@/core/ui/DetailSection';
import { Settings } from 'lucide-react';

interface YourItemSettingsFormProps {
  onCancel: () => void;
}

export const YourItemSettingsForm: React.FC<YourItemSettingsFormProps> = () => {
  return (
    <div className="space-y-4">
      <DetailSection title="Plugin settings" icon={Settings}>
        <p className="text-sm text-muted-foreground">
          Replace this with your plugin settings (e.g. API keys, preferences).
          Use the same DetailSection and form controls as in YourItemForm.
        </p>
      </DetailSection>
    </div>
  );
};
