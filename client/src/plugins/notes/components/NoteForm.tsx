import { Info } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { RichTextEditor } from '@/core/ui/RichTextEditor';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import { useNotes } from '../hooks/useNotes';

import { NoteSettingsForm } from './NoteSettingsForm';

const NOTE_FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

interface NoteFormState {
  title: string;
  content: string;
  mentions: any[];
}

interface NoteFormProps {
  currentNote?: any;
  onSave: (data: NoteFormState) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const NoteForm: React.FC<NoteFormProps> = ({
  currentNote,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode } = useNotes();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<NoteFormState>({
    title: '',
    content: '',
    mentions: [],
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  useEffect(() => {
    const formKey = `note-form-${currentNote?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentNote, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: [],
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentNote) {
      setFormData({
        title: currentNote.title || '',
        content: currentNote.content || '',
        mentions: currentNote.mentions || [],
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentNote, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success) {
        markClean();
        if (!currentNote) {
          resetForm();
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentNote, resetForm, isCurrentlySubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  useEffect(() => {
    window.submitNotesForm = () => handleSubmit();
    (window as any).submitNoteForm = window.submitNotesForm;
    window.cancelNotesForm = () => handleCancel();
    (window as any).cancelNoteForm = window.cancelNotesForm;
    return () => {
      delete window.submitNotesForm;
      delete (window as any).submitNoteForm;
      delete window.cancelNotesForm;
      delete (window as any).cancelNoteForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentNote) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
      onCancel();
    }
  };

  const updateField = (field: keyof NoteFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const handleContentChange = (content: string, mentions: any[]) => {
    setFormData((prev) => ({ ...prev, content, mentions }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  if (panelMode === 'settings') {
    return <NoteSettingsForm onCancel={onCancel} />;
  }

  const formSidebar = currentNote ? (
    <div className="space-y-4">
      <Card padding="none" className={NOTE_FORM_CARD_CLASS}>
        <DetailSection
          title={t('notes.information')}
          icon={Info}
          iconPlugin="notes"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('notes', currentNote.id)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {currentNote.createdAt ? new Date(currentNote.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">
                {currentNote.updatedAt ? new Date(currentNote.updatedAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
      <DetailActivityLog entityType="note" entityId={currentNote.id} title={t('notes.activity')} />
    </div>
  ) : undefined;

  return (
    <>
      <div
        className={cn(
          'plugin-notes min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm text-destructive font-medium">{t('common.cannotSave')}</div>
                <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
                  {validationErrors
                    .filter((error) => !error.message.includes('Warning'))
                    .map((error) => (
                      <li key={`${error.field}-${error.message}`}>{error.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            <Card padding="none" className={NOTE_FORM_CARD_CLASS}>
              <DetailSection title={t('notes.noteContent')} iconPlugin="notes" className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="note-title" className="mb-1">
                      {t('notes.title')}
                    </Label>
                    <Input
                      id="note-title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder={t('notes.titlePlaceholder')}
                      className={getFieldError('title') ? 'border-red-500' : ''}
                      required
                    />
                    {getFieldError('title') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('title')?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="mb-1">{t('notes.content')}</Label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={handleContentChange}
                      placeholder={t('notes.contentPlaceholder')}
                      className={getFieldError('content') ? 'border-red-500' : ''}
                    />
                    {getFieldError('content') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('content')?.message}
                      </p>
                    )}
                  </div>
                </div>
              </DetailSection>
            </Card>

            {currentNote ? (
              <FileAttachmentsSection pluginName="notes" entityId={currentNote.id} />
            ) : null}
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentNote ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
};
