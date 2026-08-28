import { Download, Upload } from 'lucide-react';
import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useTasks } from '../hooks/useTasks';

interface TaskSettingsFormProps {
  onCancel: () => void;
}

const getTaskImportSchema = (): ImportSchema => ({
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'priority', label: 'Priority', required: false },
  ],
});

const TASK_IMPORT_EXAMPLE_ROW: Record<string, string> = {
  title: 'Follow up with client',
  content: 'Send proposal draft',
  status: 'not started',
  priority: 'Medium',
};

/** Legacy panel settings — import only (list view prefs live on the list header). */
export const TaskSettingsForm = React.forwardRef<PanelFormHandle, TaskSettingsFormProps>(
  function TaskSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { importTasks } = useTasks();
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
            <p className="mb-4 text-sm text-muted-foreground">{t('tasks.importDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <RoundIconLabelButton
                type="button"
                icon={Download}
                label={t('importWizard.downloadTemplate')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: getTaskImportSchema(),
                    filename: 'tasks-import-template.csv',
                    exampleRow: TASK_IMPORT_EXAMPLE_ROW,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('common.import')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() => setIsImportWizardOpen(true)}
              />
            </div>
          </DetailSection>
        </div>

        <ImportWizard
          isOpen={isImportWizardOpen}
          onClose={() => setIsImportWizardOpen(false)}
          onImport={importTasks}
          schema={getTaskImportSchema()}
          title={t('common.import')}
        />
      </>
    );
  },
);
