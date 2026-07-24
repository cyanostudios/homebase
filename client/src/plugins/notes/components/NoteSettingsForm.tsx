import { Check, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import {
  NOTES_COLUMN_COUNT_STORAGE_KEY,
  NOTES_SETTINGS_KEY,
  resolveNoteColumnCount,
  type NoteColumnCount,
} from '../utils/noteColumnCount';

export interface NoteSettingsFormProps {
  onCancel: () => void;
}

const COLUMN_OPTIONS: NoteColumnCount[] = [1, 2, 3];

export const NoteSettingsForm = React.forwardRef<PanelFormHandle, NoteSettingsFormProps>(
  function NoteSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [columnCount, setColumnCount] = useState<NoteColumnCount>(1);
    const [initialColumnCount, setInitialColumnCount] = useState<NoteColumnCount>(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(NOTES_SETTINGS_KEY);
          const loaded = resolveNoteColumnCount(settings);
          setColumnCount(loaded);
          setInitialColumnCount(loaded);
        } catch (error) {
          console.error('Failed to load notes settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const isDirty = columnCount !== initialColumnCount;

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await updateSettings(NOTES_SETTINGS_KEY, { columnCount });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        }
        setInitialColumnCount(columnCount);
        onCancel();
      } catch (error) {
        console.error('Failed to save notes settings:', error);
      } finally {
        setIsSaving(false);
      }
    }, [columnCount, updateSettings, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>{t('notes.defaultColumns')}</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">{t('notes.columnsLabel')}</Label>
                <p className="text-[11px] text-gray-500">{t('notes.columnsHelp')}</p>
              </div>
              <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                {COLUMN_OPTIONS.map((count) => (
                  <Button
                    key={count}
                    variant={columnCount === count ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 min-w-8 px-3 text-[10px] font-bold tracking-tight',
                      columnCount !== count &&
                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                    )}
                    onClick={() => setColumnCount(count)}
                    aria-label={t(`notes.columns${count}`)}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </DetailCard>
        </DetailSection>

        {isDirty && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              variant="primary"
              size="sm"
              icon={Check}
              disabled={isSaving}
              className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
