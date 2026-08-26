import { Maximize2, Minimize2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import { useNotes } from '../hooks/useNotes';

import { NoteSettingsForm } from './NoteSettingsForm';

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

interface NoteFormState {
  title: string;
  content: string;
  mentions: any[];
  showTitleInContent: boolean;
}

interface NoteFormProps {
  currentNote?: any;
  onSave: (data: NoteFormState) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const NoteForm = React.forwardRef<PanelFormHandle, NoteFormProps>(function NoteForm(
  { currentNote, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
  ref,
) {
  const { t } = useTranslation();
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
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
  const [focusMode, setFocusMode] = useState(false);
  const [formData, setFormData] = useState<NoteFormState>({
    title: '',
    content: '',
    mentions: [],
    showTitleInContent: true,
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  useEffect(() => {
    const formKey = `note-form-${currentNote?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentNote, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    setFocusMode(false);
  }, [currentNote?.id]);

  useEffect(() => {
    if (!focusMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: [],
      showTitleInContent: true,
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentNote) {
      setFormData({
        title: currentNote.title || '',
        content: currentNote.content || '',
        mentions: currentNote.mentions || [],
        showTitleInContent: currentNote.showTitleInContent !== false,
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
        setFocusMode(false);
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

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: () => attemptAction(onCancel),
    }),
    [handleSubmit, attemptAction, onCancel],
  );

  const handleDiscardChanges = useCallback(() => {
    if (!currentNote) {
      resetForm();
    }
    setFocusMode(false);
    confirmDiscard();
    onCancel();
  }, [currentNote, confirmDiscard, onCancel, resetForm]);

  const updateField = (field: keyof NoteFormState, value: string | boolean | any[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const handleContentChange = (content: string, mentions: any[]) => {
    // TipTap may normalize '' to '<p></p>' on init — don't treat that as a user edit
    if (!isEmptyRichText(content) || !isEmptyRichText(formData.content)) {
      markDirty();
    }
    setFormData((prev) => ({ ...prev, content, mentions }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  if (panelMode === 'settings') {
    return <NoteSettingsForm ref={ref} onCancel={onCancel} />;
  }

  const focusModeToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={focusMode ? Minimize2 : Maximize2}
      className={DETAIL_ENTITY_LINK_TRIGGER_CLASS}
      aria-pressed={focusMode}
      title={t('notes.focusModeHint')}
      onClick={() => setFocusMode((open) => !open)}
    >
      {focusMode ? t('notes.exitFocusMode') : t('notes.focusMode')}
    </Button>
  );

  const contentColumn = (
    <div className="space-y-4">
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

      <Card
        padding="none"
        className={cn(
          DETAIL_VIEW_CARD_CLASS,
          focusMode && 'relative z-50 mx-auto w-full max-w-[1080px] shadow-lg',
        )}
      >
        <DetailSection
          title={t('notes.noteContent')}
          iconPlugin="notes"
          className="p-6"
          action={focusModeToggle}
        >
          <div
            className={cn(
              'space-y-4',
              focusMode && '[&_.rich-text-editor]:min-h-[min(70vh,560px)]',
            )}
          >
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <Label htmlFor="note-title">{t('notes.title')}</Label>
                <label
                  htmlFor="note-show-title-in-content"
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                >
                  <input
                    id="note-show-title-in-content"
                    type="checkbox"
                    checked={formData.showTitleInContent}
                    onChange={(e) => updateField('showTitleInContent', e.target.checked)}
                    className="h-4 w-4"
                  />
                  {t('notes.showTitleInContent')}
                </label>
              </div>
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
              <React.Suspense
                fallback={
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled
                  />
                }
              >
                <RichTextEditor
                  value={formData.content}
                  onChange={handleContentChange}
                  placeholder={t('notes.contentPlaceholder')}
                  className={getFieldError('content') ? 'border-red-500' : ''}
                />
              </React.Suspense>
              {getFieldError('content') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {getFieldError('content')?.message}
                </p>
              )}
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );

  const attachmentsSection =
    hasFilesPlugin && currentNote ? (
      <FileAttachmentsSection pluginName="notes" entityId={currentNote.id} />
    ) : hasFilesPlugin ? (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('files.attachmentsTitle')}
          iconPlugin="files"
          subtleTitle
          className="p-4"
        >
          <p className="text-xs text-muted-foreground">{t('notes.attachmentsAfterSave')}</p>
        </DetailSection>
      </Card>
    ) : null;

  const metaSection = currentNote ? (
    <div className="space-y-4">
      <DetailActivityLog entityType="note" entityId={currentNote.id} title={t('notes.activity')} />
    </div>
  ) : undefined;

  return (
    <>
      {focusMode ? (
        <button
          type="button"
          aria-label={t('notes.exitFocusMode')}
          className="fixed inset-0 z-40 cursor-default border-0 bg-slate-950/55 p-0"
          onClick={() => setFocusMode(false)}
        />
      ) : null}

      <div className="plugin-notes">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <DetailLayout sidebar={focusMode ? undefined : metaSection}>
            <div className="space-y-4">
              {contentColumn}
              {!focusMode ? attachmentsSection : null}
            </div>
          </DetailLayout>
        </form>
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
});
