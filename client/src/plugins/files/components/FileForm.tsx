// client/src/plugins/files/components/FileForm.tsx
import { Upload, File as FileIcon, Trash2, AlertTriangle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';
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

export const FileForm: React.FC<FileFormProps> = ({ currentItem, onSave, onCancel }) => {
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

  useEffect(() => {
    window.submitFilesForm = () => handleSubmit();
    window.cancelFilesForm = () => handleCancel();
    return () => {
      delete window.submitFilesForm;
      delete window.cancelFilesForm;
    };
  }, [handleSubmit, handleCancel]);

  // Settings: render settings form (after all hooks so rules-of-hooks are satisfied)
  if (panelMode === 'settings') {
    return <FileSettingsForm onCancel={onCancel} />;
  }

  // ---------------- render ----------------
  if (isEdit) {
    // ----- EDIT (rename only) -----
    return (
      <div className="p-6 space-y-6">
        <DetailSection title="Rename File">
          <p className="text-sm text-muted-foreground mb-4">
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
      </div>
    );
  }

  // ----- CREATE (upload) -----
  return (
    <div className="p-6 space-y-6">
      <DetailSection title="Upload Files">
        <p className="text-sm text-muted-foreground mb-4">
          Dra & släpp filer eller klicka för att välja flera.
        </p>

        {(filesErrors.length > 0 || generalErrors.length > 0) && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
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
            'border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer',
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
            filesErrors.length && 'border-destructive/50 bg-destructive/5',
          )}
          onClick={pick}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Släpp filer här eller <span className="text-primary underline">välj filer</span>
            </div>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={onChange} />
          </div>
        </div>

        {items.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium text-sm">Filer i kö ({items.length})</h4>
            <div className="divide-y divide-border rounded-lg border border-border bg-background">
              {items.map(({ id, file }) => (
                <div key={id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
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
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DetailSection>
    </div>
  );
};
