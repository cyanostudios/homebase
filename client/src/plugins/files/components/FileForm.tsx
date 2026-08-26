import { Upload, File as FileIcon, Trash2, AlertTriangle, Info } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_INFO_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useFiles } from '../hooks/useFiles';
import type { ValidationError } from '../types/files';

import { FileSettingsForm } from './FileSettingsForm';

interface FileFormProps {
  currentItem?: { id?: string; name?: string } | null; // finns i edit-läge
  onSave: (data: any) => Promise<boolean> | boolean;
  onCancel: () => void;
}

type Picked = { id: string; file: File };

export const FileForm = React.forwardRef<PanelFormHandle, FileFormProps>(function FileForm(
  { currentItem, onSave, onCancel },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode } = useFiles();
  const isEdit = !!currentItem; // edit-läge om vi har ett item
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Loading state to prevent double submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getErrors = useCallback(
    (field: string) =>
      validationErrors.filter((e: ValidationError) => e.field === field).map((e) => e.message),
    [validationErrors],
  );
  const filesErrors = getErrors('_files');
  const generalErrors = getErrors('general');
  const nameErrors = getErrors('name');
  const hasAnyError = validationErrors.length > 0;

  // ---- CREATE (upload) state ----
  const [items, setItems] = useState<Picked[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // ---- EDIT (rename) state ----
  const [name, setName] = useState<string>(currentItem?.name ?? '');

  // initiera namn vid byte av item
  useEffect(() => {
    if (isEdit) {
      setName(currentItem?.name ?? '');
      setItems([]); // säkerställ att ev. gamla val rensas
    } else {
      setName('');
    }
    // rensa ev. gamla fel när man byter läge
    clearValidationErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, currentItem?.name]);

  // ------------ helpers for CREATE ------------
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
    // användaren ändrade valet → rensa visade fel
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
      // Ignore errors when clearing drag data
    }
  };
  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) {
      setDragOver(true);
    }
  };
  const onDragEnter: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) {
      setDragOver(true);
    }
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };
  const sizeStr = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
    let n = bytes,
      i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
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
        // EDIT: enbart byta namn
        const ok = await onSave({ name: name?.trim() || '' });
        return ok;
      } else {
        // CREATE: skicka alla valda filer (_files) för multi-create
        const ok = await onSave({ _files: items.map((p) => p.file) });
        if (ok) {
          setItems([]);
        }
        return ok;
      }
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [panelMode, isEdit, onSave, name, items, isSubmitting]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  // Settings: render settings form (after all hooks so rules-of-hooks are satisfied)
  if (panelMode === 'settings') {
    return (
      <div className="p-4">
        <FileSettingsForm onCancel={onCancel} />
      </div>
    );
  }

  // ---------------- render ----------------
  if (isEdit) {
    const editSidebar = (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('files.viewInformation')}
          icon={Info}
          iconPlugin="files"
          subtleTitle
          className="p-4"
          collapsible
        >
          <div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">{t('files.viewId')}</span>
              <span className="font-mono font-extrabold text-foreground">
                {currentItem?.id != null ? formatDisplayNumber('files', currentItem.id) : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    );

    return (
      <div className="plugin-files">
        <DetailLayout sidebar={editSidebar}>
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection title="Rename File" iconPlugin="files" className="p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Ändra endast filnamnet. Själva filinnehållet hanteras via upload i Create-läget.
              </p>
              <div className="space-y-2">
                <Label htmlFor="file-name">Name *</Label>
                <Input
                  id="file-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (hasAnyError) {
                      clearValidationErrors();
                    }
                  }}
                  className={nameErrors.length ? 'border-destructive' : ''}
                  placeholder="document.pdf"
                />
                {nameErrors.length > 0 && (
                  <p className="text-sm text-destructive">{nameErrors.join(' • ')}</p>
                )}
              </div>
            </DetailSection>
          </Card>
        </DetailLayout>
      </div>
    );
  }

  // ----- CREATE (upload) -----
  return (
    <div className="plugin-files">
      <DetailLayout>
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title="Upload Files" iconPlugin="files" className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Dra & släpp filer eller klicka för att välja flera.
            </p>

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
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              className={cn(
                'cursor-pointer rounded-xl border-2 border-dashed p-8 transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
                filesErrors.length && 'border-destructive/50 bg-destructive/5',
              )}
              onClick={pick}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Släpp filer här eller <span className="text-primary underline">välj filer</span>
                </div>
                <input ref={inputRef} type="file" multiple className="hidden" onChange={onChange} />
              </div>
            </div>

            {items.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-medium">Filer i kö ({items.length})</h4>
                <div className="divide-y divide-border rounded-lg border border-border bg-background">
                  {items.map(({ id, file }) => (
                    <div key={id} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {file.type || 'application/octet-stream'} • {sizeStr(file.size)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(id)}
                        title="Remove"
                        className="h-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DetailSection>
        </Card>
      </DetailLayout>
    </div>
  );
});
