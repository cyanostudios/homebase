import {
  FileText,
  History,
  Info,
  Link2,
  Maximize2,
  Minimize2,
  Paperclip,
  StickyNote,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_ERROR_CLASS } from '@/core/ui/formFieldStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import { useNotes } from '../hooks/useNotes';

const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

type NoteFormTab = 'information' | 'linked' | 'files' | 'activity';

const NOTE_FORM_TABS: NoteFormTab[] = ['information', 'linked', 'files', 'activity'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const NOTE_FORM_EDIT_DISABLED_TABS: ReadonlySet<NoteFormTab> = new Set(['linked', 'activity']);

const TAB_ERROR_FIELDS: Record<NoteFormTab, string[]> = {
  information: ['title', 'content'],
  linked: [],
  files: [],
  activity: [],
};

function parseNoteFormTab(value: string | null): NoteFormTab {
  if (value && NOTE_FORM_TABS.includes(value as NoteFormTab)) {
    return value as NoteFormTab;
  }
  return 'information';
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
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
  /** Close/Update rendered in the header card title row — matches view chrome. */
  headerTrailing?: React.ReactNode;
}

export const NoteForm = React.forwardRef<PanelFormHandle, NoteFormProps>(function NoteForm(
  {
    currentNote,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
    stacked: _stacked = false,
    headerTrailing,
  },
  ref,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseNoteFormTab(searchParams.get('tab'));
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const { validationErrors, clearValidationErrors } = useNotes();
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
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

  const setActiveTab = useCallback(
    (tab: NoteFormTab, replace = false) => {
      if (NOTE_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      if (tab === 'files' && !hasFilesPlugin) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [hasFilesPlugin, setSearchParams],
  );

  // Linked / Activity stay visible (greyed) but are not editable — leave those tabs if URL preserved them from View.
  useEffect(() => {
    if (NOTE_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      setActiveTab('information', true);
      return;
    }
    if (activeTab === 'files' && !hasFilesPlugin) {
      setActiveTab('information', true);
    }
  }, [activeTab, hasFilesPlugin, setActiveTab]);

  // While create/edit is open, block list + sidebar navigation (same discard prompt as Close).
  useEffect(() => {
    const formKey = `note-form-${currentNote?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [currentNote, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
      cancel: () => attemptAction(onCancel, { force: true }),
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

  const tabHasError = useCallback(
    (tab: NoteFormTab) => {
      const fields = TAB_ERROR_FIELDS[tab];
      if (!fields.length) {
        return false;
      }
      return validationErrors.some(
        (error) => fields.includes(error.field) && !error.message.includes('Warning'),
      );
    },
    [validationErrors],
  );

  const tabs = useMemo(() => {
    const next: Array<{
      id: NoteFormTab;
      label: string;
      icon: typeof Info;
      count: number | null;
    }> = [
      {
        id: 'information',
        label: t('notes.tabs.information'),
        icon: Info,
        count: null,
      },
      {
        id: 'linked',
        label: t('notes.tabs.linked'),
        icon: Link2,
        count: null,
      },
    ];
    if (hasFilesPlugin) {
      next.push({
        id: 'files',
        label: t('notes.tabs.files'),
        icon: Paperclip,
        count: null,
      });
    }
    next.push({
      id: 'activity',
      label: t('notes.tabs.activity'),
      icon: History,
      count: null,
    });
    return next;
  }, [hasFilesPlugin, t]);

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = NOTE_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        const hasError = !isDisabled && tabHasError(tab.id);
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('notes.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {hasError ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                  aria-label={t('common.error', { defaultValue: 'Error' })}
                />
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

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

  const informationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, focusMode && 'shadow-lg')}>
      <DetailSection
        title={t('notes.noteContent')}
        icon={FileText}
        iconPlugin="notes"
        className="p-6"
        action={focusModeToggle}
      >
        <div
          className={cn('space-y-4', focusMode && '[&_.rich-text-editor]:min-h-[min(70vh,560px)]')}
        >
          {focusMode ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <Label htmlFor="note-focus-title" className={DETAIL_FIELD_LABEL_CLASS}>
                  {t('notes.title')}
                </Label>
                <label
                  htmlFor="note-focus-show-title-in-content"
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                >
                  <input
                    id="note-focus-show-title-in-content"
                    type="checkbox"
                    checked={formData.showTitleInContent}
                    onChange={(e) => updateField('showTitleInContent', e.target.checked)}
                    className="h-4 w-4"
                  />
                  {t('notes.showTitleInContent')}
                </label>
              </div>
              <Input
                id="note-focus-title"
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={t('notes.titlePlaceholder')}
                className={cn(
                  DETAIL_FORM_TITLE_INPUT_CLASS,
                  PLUGIN_PAGE_TITLE_CLASS,
                  'min-w-0 w-full tracking-[0.003em]',
                  getFieldError('title') && FORM_INPUT_ERROR_CLASS,
                )}
                required
              />
              {getFieldError('title') ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {getFieldError('title')?.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex justify-end">
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
          )}
          <div>
            {!focusMode ? (
              <Label className={cn(DETAIL_FIELD_LABEL_CLASS, 'mb-1')}>{t('notes.content')}</Label>
            ) : null}
            <React.Suspense
              fallback={
                <textarea
                  className="min-h-[120px] w-full rounded-md border-0 bg-primary/10 px-3 py-2 text-sm leading-relaxed"
                  disabled
                />
              }
            >
              <RichTextEditor
                value={formData.content}
                onChange={handleContentChange}
                placeholder={t('notes.contentPlaceholder')}
                variant="ghost"
                className={cn(getFieldError('content') && FORM_INPUT_ERROR_CLASS)}
              />
            </React.Suspense>
            {getFieldError('content') ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('content')?.message}
              </p>
            ) : null}
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const filesCard = hasFilesPlugin ? (
    currentNote ? (
      <FileAttachmentsSection pluginName="notes" entityId={currentNote.id} />
    ) : (
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
    )
  ) : null;

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon
              icon={StickyNote}
              className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            />
          </span>
          <div className="min-w-0 flex-1">
            <Input
              id="note-title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('notes.titlePlaceholder')}
              aria-label={t('notes.title')}
              className={cn(
                DETAIL_FORM_TITLE_INPUT_CLASS,
                PLUGIN_PAGE_TITLE_CLASS,
                'min-w-0 tracking-[0.003em]',
                getFieldError('title') && FORM_INPUT_ERROR_CLASS,
              )}
              required
            />
            {getFieldError('title') ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('title')?.message}
              </p>
            ) : null}
          </div>
          {headerTrailing ? (
            <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-border/40 px-4 py-3">{tabChips}</div>
    </Card>
  );

  const focusOverlay =
    focusMode && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t('notes.exitFocusMode')}
              className="fixed inset-0 z-40 cursor-default border-0 bg-slate-950/55 p-0"
              onClick={() => setFocusMode(false)}
            />
            <div
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
              role="presentation"
            >
              <div
                className="pointer-events-auto max-h-[min(90vh,900px)] w-full max-w-[1080px] overflow-y-auto overscroll-contain"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t('notes.focusMode')}
              >
                {informationCard}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {focusOverlay}

      <div className={cn('plugin-notes', focusMode && 'invisible pointer-events-none')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <DetailLayout gridClassName="grid-cols-1">
            {hasBlockingErrors && (
              <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
                <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                  {validationErrors
                    .filter((error) => !error.message.includes('Warning'))
                    .map((error) => (
                      <li key={`${error.field}-${error.message}`}>{error.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            {formHeader}

            {/* Single mount of editor: in layout when not focused; portaled when focused */}
            {activeTab === 'information' && !focusMode ? informationCard : null}
            {activeTab === 'files' ? filesCard : null}
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
