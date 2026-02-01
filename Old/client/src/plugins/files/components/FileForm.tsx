// client/src/plugins/files/components/FileForm.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, File as FileIcon, Trash2, AlertTriangle } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import { useFiles } from '../hooks/useFiles';
import type { ValidationError } from '../types/files';

interface FileFormProps {
  currentItem?: { id?: string; name?: string } | null; // finns i edit-läge
  onSave: (data: any) => Promise<boolean> | boolean;
  onCancel: () => void;
}

type Picked = { id: string; file: File };

export const FileForm: React.FC<FileFormProps> = ({ currentItem, onSave, onCancel }) => {
  const isEdit = !!currentItem; // edit-läge om vi har ett item
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ---- Files context: visa/rensa valideringsfel från servern ----
  const { validationErrors, clearValidationErrors } = useFiles();

  const getErrors = useCallback(
    (field: string) => validationErrors.filter((e: ValidationError) => e.field === field).map((e) => e.message),
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
    if (!list.length) return;
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const f of list) {
        const id = toId(f);
        if (!existing.has(id)) merged.push({ id, file: f });
      }
      return merged;
    });
    // användaren ändrade valet → rensa visade fel
    if (hasAnyError) clearValidationErrors();
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (hasAnyError) clearValidationErrors();
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
          if (f) picked.push(f);
        }
      }
      if (picked.length) addFiles(picked);
      else if (dt.files?.length) addFiles(dt.files);
    } else if (dt?.files?.length) {
      addFiles(dt.files);
    }
    try {
      dt?.clearData();
    } catch {}
  };
  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  };
  const onDragEnter: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (e.target.files) addFiles(e.target.files);
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

  // ------------ submit/cancel via universal footer ------------
  const handleSubmit = useCallback(async () => {
    if (isEdit) {
      // EDIT: enbart byta namn
      const ok = await onSave({ name: name?.trim() || '' });
      return ok;
    } else {
      // CREATE: skicka alla valda filer (_files) för multi-create
      const ok = await onSave({ _files: items.map((p) => p.file) });
      if (ok) setItems([]);
      return ok;
    }
  }, [isEdit, onSave, name, items]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    const onSubmit = () => {
      void handleSubmit();
    };
    const onCancelEv = () => handleCancel();
    window.addEventListener('submitFileForm', onSubmit as EventListener);
    window.addEventListener('cancelFileForm', onCancelEv as EventListener);
    return () => {
      window.removeEventListener('submitFileForm', onSubmit as EventListener);
      window.removeEventListener('cancelFileForm', onCancelEv as EventListener);
    };
  }, [handleSubmit, handleCancel]);

  // ---------------- render ----------------
  if (isEdit) {
    // ----- EDIT (rename only) -----
    return (
      <Card className="shadow-none">
        <Heading level={2} className="mb-2">
          Rename File
        </Heading>
        <Text variant="caption" className="text-gray-500 mb-4 block">
          Ändra endast filnamnet. Själva filinnehållet hanteras via upload i Create-läget.
        </Text>

        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="file-name">
          Name *
        </label>
        <input
          id="file-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (hasAnyError) clearValidationErrors();
          }}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            nameErrors.length ? 'border-red-400' : 'border-gray-300'
          }`}
          placeholder="document.pdf"
        />
        {nameErrors.length > 0 && (
          <div className="mt-1 text-xs text-red-600">{nameErrors.join(' • ')}</div>
        )}

        <Text variant="caption" className="text-gray-500 mt-3 block">
          Tryck Save i panelens footer för att spara namnet.
        </Text>
      </Card>
    );
  }

  // ----- CREATE (upload) -----
  return (
    <Card className="shadow-none">
      <Heading level={2} className="mb-2">
        Upload Files
      </Heading>
      <Text variant="caption" className="text-gray-500 mb-3 block">
        Dra & släpp filer eller klicka för att välja flera.
      </Text>

      {/* Error banner */}
      {(filesErrors.length > 0 || generalErrors.length > 0) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            {(filesErrors.length ? filesErrors : generalErrors).map((m, i) => (
              <div key={i}>{m}</div>
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
        className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
        } ${filesErrors.length ? 'border-red-400 bg-red-50/50' : ''}`}
        onClick={pick}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Upload className="w-8 h-8" />
          <div className="text-sm text-gray-700">
            Släpp filer här eller <span className="text-blue-600 underline">välj filer</span>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={onChange} />
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-6">
          <Heading level={3} className="mb-3">
            Filer i kö ({items.length})
          </Heading>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {items.map(({ id, file }) => (
              <div key={id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon className="w-5 h-5 text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">
                      {file.type || 'application/octet-stream'} • {sizeStr(file.size)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center text-sm px-2 py-1 rounded hover:bg-gray-50"
                  onClick={() => remove(id)}
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
