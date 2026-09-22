import { Upload, File as FileIcon, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { FORM_GHOST_INPUT_CLASS, FORM_INPUT_ERROR_CLASS } from '@/core/ui/formFieldStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useFiles } from '../hooks/useFiles';
import type { ValidationError } from '../types/files';
import { humanSize } from '../utils/humanSize';

import { FileSettingsForm } from './FileSettingsForm';

interface FileFormProps {
  currentItem?: { id?: string; name?: string } | null;
  onSave: (data: any) => Promise<boolean> | boolean;
  onCancel: () => void;
  /** Single-column layout for list detail column. */
  stacked?: boolean;
  headerTrailing?: React.ReactNode;
}

type Picked = { id: string; file: File };

export const FileForm = React.forwardRef<PanelFormHandle, FileFormProps>(function FileForm(
  { currentItem, onSave, onCancel, stacked = false, headerTrailing },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode, closeFilePanel } = useFiles();
  const isEdit = !!currentItem;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  useEffect(() => {
    if (panelMode === 'settings') {
      return;
    }
    const formKey = `file-form-${currentItem?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [currentItem?.id, panelMode, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const getErrors = useCallback(
    (field: string) =>
      validationErrors.filter((e: ValidationError) => e.field === field).map((e) => e.message),
    [validationErrors],
  );
  const filesErrors = getErrors('_files');
  const generalErrors = getErrors('general');
  const nameErrors = getErrors('name');
  const hasAnyError = validationErrors.length > 0;
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const [items, setItems] = useState<Picked[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState<string>(currentItem?.name ?? '');

  useEffect(() => {
    if (isEdit) {
      setName(currentItem?.name ?? '');
      setItems([]);
    } else {
      setName('');
    }
    clearValidationErrors();
    markClean();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, currentItem?.name]);

  const pick = () => inputRef.current?.click();
  const toId = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
  const addFiles = (fs: File[] | FileList) => {
    const list: File[] = Array.from(fs as ArrayLike<File>);
    if (!list.length) {
      return;
    }
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const f of list) {
        const id = toId(f);
        if (!existing.has(id)) {
          merged.push({ id, file: f });
        }
      }
      return merged;
    });
    if (hasAnyError) {
      clearValidationErrors();
    }
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (hasAnyError) {
      clearValidationErrors();
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (dt?.items && dt.items.length) {
      const picked: File[] = [];
      for (let i = 0; i < dt.items.length; i++) {
        const it = dt.items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) {
            picked.push(f);
          }
        }
      }
      if (picked.length) {
        addFiles(picked);
      } else if (dt.files?.length) {
        addFiles(dt.files);
      }
    } else if (dt?.files?.length) {
      addFiles(dt.files);
    }
    try {
      dt?.clearData();
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = useCallback(async () => {
    if (panelMode === 'settings') {
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit) {
        return await onSave({ name: name?.trim() || '' });
      }
      const ok = await onSave({ _files: items.map((p) => p.file) });
      if (ok) {
        setItems([]);
      }
      return ok;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [panelMode, isEdit, onSave, name, items, isSubmitting]);

  const handleCancel = useCallback(() => {
    // Core cancel-from-edit calls openForView; files has no full view and openFileForView
    // opens edit — so cancel must close the panel directly.
    attemptAction(() => closeFilePanel(), { force: true });
  }, [attemptAction, closeFilePanel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const saveCancelRow = (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={X}
        onClick={handleCancel}
        disabled={isSubmitting}
        className="h-9 px-3 text-xs"
      >
        {t('common.cancel')}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={Check}
        onClick={() => void handleSubmit()}
        disabled={hasBlockingErrors || isSubmitting}
        className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
      >
        {isSubmitting
          ? t('common.saving')
          : panelMode === 'edit'
            ? t('common.update')
            : t('common.save')}
      </Button>
    </div>
  );

  if (panelMode === 'settings') {
    return (
      <div className="p-4">
        <FileSettingsForm onCancel={onCancel} />
      </div>
    );
  }

  const stackedEditHeader =
    stacked && headerTrailing ? (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <Input
                id="file-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  markDirty();
                  if (hasAnyError) {
                    clearValidationErrors();
                  }
                }}
                className={cn(
                  DETAIL_FORM_TITLE_INPUT_CLASS,
                  PLUGIN_PAGE_TITLE_CLASS,
                  'min-w-0 tracking-[0.003em]',
                  nameErrors.length && FORM_INPUT_ERROR_CLASS,
                )}
                placeholder="document.pdf"
                aria-label={t('files.formNameLabel')}
              />
              {nameErrors.length > 0 ? (
                <p className="mt-1 text-sm text-destructive">{nameErrors.join(' • ')}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
          </div>
        </div>
      </Card>
    ) : null;

  const stackedUploadHeader =
    stacked && headerTrailing ? (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1 tracking-[0.003em]')}>
              {t('files.formUploadTitle')}
            </h3>
            <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
          </div>
        </div>
      </Card>
    ) : null;

  if (isEdit) {
    return (
      <div className="plugin-files">
        <DetailLayout gridClassName="grid-cols-1">
          <div className="space-y-4">
            {stackedEditHeader}
            {stacked && headerTrailing ? (
              <p className="px-1 text-sm text-muted-foreground">{t('files.formRenameHelp')}</p>
            ) : (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('files.formRenameTitle')}
                  iconPlugin="files"
                  className="p-6"
                >
                  <p className="mb-4 text-sm text-muted-foreground">{t('files.formRenameHelp')}</p>
                  <div className="space-y-2">
                    <Label htmlFor="file-name-body">{t('files.formNameLabel')}</Label>
                    <Input
                      id="file-name-body"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        markDirty();
                        if (hasAnyError) {
                          clearValidationErrors();
                        }
                      }}
                      className={cn(
                        FORM_GHOST_INPUT_CLASS,
                        nameErrors.length && FORM_INPUT_ERROR_CLASS,
                      )}
                      placeholder="document.pdf"
                    />
                    {nameErrors.length > 0 ? (
                      <p className="text-sm text-destructive">{nameErrors.join(' • ')}</p>
                    ) : null}
                  </div>
                </DetailSection>
              </Card>
            )}
          </div>
        </DetailLayout>
        <ConfirmDialog
          isOpen={showWarning}
          title={t('dialog.unsavedChanges')}
          message={t('dialog.discardAndReturn')}
          confirmText={t('dialog.discardChanges')}
          cancelText={t('dialog.continueEditing')}
          onConfirm={() => {
            confirmDiscard();
            closeFilePanel();
          }}
          onCancel={cancelDiscard}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="plugin-files">
      <DetailLayout gridClassName="grid-cols-1">
        <div className="space-y-4">
          {stackedUploadHeader}
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('files.formUploadTitle')}
              iconPlugin="files"
              className="p-6"
              subtleTitle={Boolean(stacked && headerTrailing)}
            >
              <p className="mb-4 text-sm text-muted-foreground">{t('files.formUploadHelp')}</p>

              {(filesErrors.length > 0 || generalErrors.length > 0) && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    {(filesErrors.length ? filesErrors : generalErrors).map((m) => (
                      <div key={String(m).slice(0, 80)}>{m}</div>
                    ))}
                  </div>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!dragOver) {
                    setDragOver(true);
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!dragOver) {
                    setDragOver(true);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                }}
                className={cn(
                  'cursor-pointer rounded-xl border-2 border-dashed p-8 transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
                  filesErrors.length && 'border-destructive/50 bg-destructive/5',
                )}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick();
                  }
                }}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    {t('files.formDropHint')}{' '}
                    <span className="text-primary underline">{t('files.formChooseFiles')}</span>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        addFiles(e.target.files);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {items.length > 0 ? (
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-medium">
                    {t('files.formQueueTitle', { count: items.length })}
                  </h4>
                  <div className="divide-y divide-border rounded-lg border border-border bg-background">
                    {items.map(({ id, file }) => (
                      <div key={id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {file.type || 'application/octet-stream'} • {humanSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => remove(id)}
                          title={t('files.formRemove')}
                          className="h-8 text-muted-foreground hover:text-destructive"
                        >
                          {t('files.formRemove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {stacked && headerTrailing ? null : saveCancelRow}
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={isEdit ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={() => {
          confirmDiscard();
          closeFilePanel();
        }}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
});
