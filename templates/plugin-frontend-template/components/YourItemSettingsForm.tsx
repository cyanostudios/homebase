import { Settings } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailSection } from '@/core/ui/DetailSection';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItemsSettings } from '../types/your-items';

export interface YourItemSettingsFormProps {
  onCancel: () => void;
}

export const YourItemSettingsForm = React.forwardRef<PanelFormHandle, YourItemSettingsFormProps>(
  function YourItemSettingsForm({ onCancel }, ref) {
    const { settings, saveSettings } = useYourItems();
    const [formData, setFormData] = useState<YourItemsSettings>({
      defaultView: 'list',
      allowDuplicate: true,
    });
    const [initialData, setInitialData] = useState<YourItemsSettings>(formData);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (settings) {
        setFormData(settings);
        setInitialData(settings);
      }
    }, [settings]);

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        const ok = await saveSettings(formData);
        if (ok) {
          setInitialData(formData);
          onCancel();
        }
      } finally {
        setIsSaving(false);
      }
    }, [formData, saveSettings, onCancel]);

    const handleCancel = useCallback(() => {
      setFormData(initialData);
      onCancel();
    }, [initialData, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: handleCancel,
      }),
      [handleSave, handleCancel],
    );

    return (
      <div className="space-y-4">
        <DetailSection title="Plugin settings" icon={Settings} iconPlugin="your-items">
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Default view</Label>
              <NativeSelect
                value={formData.defaultView}
                disabled={isSaving}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultView: e.target.value === 'grid' ? 'grid' : 'list',
                  }))
                }
              >
                <option value="list">List</option>
                <option value="grid">Grid</option>
              </NativeSelect>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <span className="text-sm font-medium">Allow duplicate action</span>
              <Switch
                checked={formData.allowDuplicate}
                disabled={isSaving}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, allowDuplicate: checked }))
                }
              />
            </div>
          </div>
        </DetailSection>
      </div>
    );
  },
);
