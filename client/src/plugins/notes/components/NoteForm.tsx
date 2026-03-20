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

import { useNotes } from '../hooks/useNotes';

import { NoteSettingsForm } from './NoteSettingsForm';

const NOTE_FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';

interface NoteFormState {
  title: string;
  content: string;
  mentions: any[]; // If you have a Mention type, replace any[] with it
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

  // Use internal state or external prop (external takes precedence)
  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  // Register this form's unsaved changes state globally
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

  // Load currentNote data when editing
  useEffect(() => {
    if (currentNote) {
      // Edit mode - load existing data
      setFormData({
        title: currentNote.title || '',
        content: currentNote.content || '',
        mentions: currentNote.mentions || [],
      });
      markClean();
    } else {
      // Create mode - reset to empty form
      resetForm();
    }
  }, [currentNote, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    } // Prevent double submission

    setIsSubmitting(true);
    try {
      console.log('Form submitting with data:', formData);
      const success = await onSave(formData);
      if (success) {
        markClean();
        if (!currentNote) {
          resetForm();
        }
      } else {
        console.log('Save failed due to validation errors');
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

  // Global functions with correct plural naming (only when not in settings mode – settings form registers its own)
  useEffect(() => {
    if (panelMode === 'settings') {
      return;
    }
    (window as any).submitNotesForm = handleSubmit; // PLURAL!
    (window as any).cancelNotesForm = handleCancel; // PLURAL!

    return () => {
      delete (window as any).submitNotesForm;
      delete (window as any).cancelNotesForm;
    };
  }, [handleSubmit, handleCancel, panelMode]);

  const handleDiscardChanges = () => {
    if (!currentNote) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      // Edit mode: close dialog and go back to detail view
      confirmDiscard();
      onCancel();
    }
  };

  const updateField = (field: keyof NoteFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const handleContentChange = (content: string, mentions: any[]) => {
    setFormData((prev) => ({ ...prev, content, mentions }));
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
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
        <DetailLayout mainClassName="max-w-[920px]" sidebar={formSidebar}>
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
