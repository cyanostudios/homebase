import { Plus, Tag, X } from 'lucide-react';
import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

import { useSlotSettings } from '../hooks/useSlotSettings';

export interface SlotsSettingsFormProps {
  onCancel: () => void;
}

/** Legacy panel settings — categories only (list view prefs live on the list header). */
export const SlotsSettingsForm = React.forwardRef<PanelFormHandle, SlotsSettingsFormProps>(
  function SlotsSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { tags, setTags, isLoading, save } = useSlotSettings();
    const [newTag, setNewTag] = useState('');
    useImperativeHandle(
      ref,
      () => ({
        submit: async () => {
          await save();
          onCancel();
        },
        cancel: onCancel,
      }),
      [save, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
    }

    const addTag = () => {
      const next = newTag.trim();
      if (!next) {
        return;
      }
      const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
      if (exists) {
        setNewTag('');
        return;
      }
      setTags((prev) => [...prev, next]);
      setNewTag('');
    };

    const removeTag = (tag: string) => {
      setTags((prev) => prev.filter((item) => item !== tag));
    };

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              <span>Categories</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Available categories</Label>
              <p className="text-[11px] text-muted-foreground">
                Categories can be assigned to slots in Slot form.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a category (e.g. VIP, Stand A)"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <RoundIconLabelButton
                type="button"
                icon={Plus}
                label="Add"
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={addTag}
                disabled={!newTag.trim()}
              />
            </div>

            {tags.length === 0 ? (
              <div className="text-sm text-muted-foreground">No categories yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove category ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </DetailCard>
        </DetailSection>
      </div>
    );
  },
);
