import { Download, Upload } from 'lucide-react';
import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useNotes } from '../hooks/useNotes';

export interface NoteSettingsFormProps {
  onCancel: () => void;
}

const getNoteImportSchema = (t: (key: string) => string): ImportSchema => ({
  fields: [
    { key: 'title', label: t('notes.title'), required: true },
    { key: 'content', label: t('notes.content'), required: true },
  ],
});

/** Legacy panel settings — import only (list view prefs live on the list header). */
export const NoteSettingsForm = React.forwardRef<PanelFormHandle, NoteSettingsFormProps>(
  function NoteSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { importNotes } = useNotes();
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => {},
        cancel: onCancel,
      }),
      [onCancel],
    );

    return (
      <>
        <div className="space-y-6">
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('notes.importDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: getNoteImportSchema(t),
                    filename: 'notes-import-template.csv',
                    exampleRow: {
                      title: t('notes.importTemplateExampleTitle'),
                      content: t('notes.importTemplateExampleContent'),
                    },
                  })
                }
                className="h-9 text-xs px-3"
              >
                {t('importWizard.downloadTemplate')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Upload}
                onClick={() => setIsImportWizardOpen(true)}
                className="h-9 text-xs px-3"
              >
                {t('notes.importTitle') || t('common.import')}
              </Button>
            </div>
          </DetailSection>
        </div>

        <ImportWizard
          isOpen={isImportWizardOpen}
          onClose={() => setIsImportWizardOpen(false)}
          onImport={importNotes}
          schema={getNoteImportSchema(t)}
          title={t('notes.importTitle') || t('common.import')}
        />
      </>
    );
  },
);
