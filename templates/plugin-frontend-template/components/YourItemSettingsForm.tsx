import React, { useCallback, useEffect, useState } from 'react';
import { DetailSection } from '@/core/ui/DetailSection';
import { Settings } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useYourItems } from '../hooks/useYourItems';
import type { YourItemsSettings } from '../types/your-items';

interface YourItemSettingsFormProps { onCancel: () => void }

export const YourItemSettingsForm: React.FC<YourItemSettingsFormProps> = ({ onCancel }) => {
  const { settings, saveSettings } = useYourItems();
  const [formData, setFormData] = useState<YourItemsSettings>({
    defaultView: 'list',
    allowDuplicate: true,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = useCallback(async () => {
    await saveSettings(formData);
  }, [formData, saveSettings]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    window.submitYourItemsForm = () => {
      void handleSubmit();
    };
    window.cancelYourItemsForm = () => {
      handleCancel();
    };
    return () => {
      delete window.submitYourItemsForm;
      delete window.cancelYourItemsForm;
    };
  }, [handleSubmit, handleCancel]);

  return (
    <div className="space-y-4">
      <DetailSection title="Plugin settings" icon={Settings}>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Default view</Label>
            <NativeSelect
              value={formData.defaultView}
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
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, allowDuplicate: checked }))
              }
            />
          </div>
        </div>
      </DetailSection>
    </div>
  );
};
