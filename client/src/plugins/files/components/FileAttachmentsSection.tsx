import { Download, ExternalLink, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { filesApi } from '@/plugins/files/api/filesApi';
import { useFileAttachments } from '@/plugins/files/hooks/useFileAttachments';
import type { FileItem } from '@/plugins/files/types/files';

/** Same shell as Slots properties / contacts cards (SlotView, SlotForm). */
const CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

function formatSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeLibraryFiles(raw: unknown): FileItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((x) => {
      const id = x && typeof x === 'object' ? (x as FileItem).id : undefined;
      return id !== undefined && id !== null;
    })
    .map((x) => {
      const f = x as FileItem;
      return { ...f, id: String(f.id) };
    });
}

export interface FileAttachmentsSectionProps {
  pluginName: string;
  entityId: string | number | null | undefined;
  /** When true: list file names only (no upload, download, or detach). */
  readOnly?: boolean;
  className?: string;
  cardClassName?: string;
}

/**
 * Attachments block: section header like Contacts/Slots properties; add row uses same
 * `grid md:grid-cols-2` + bordered cells as Contacts contact properties.
 */
export function FileAttachmentsSection({
  pluginName,
  entityId,
  readOnly = false,
  className,
  cardClassName,
}: FileAttachmentsSectionProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    attachments,
    loading,
    uploading,
    attachingExisting,
    error,
    upload,
    attachExisting,
    detach,
  } = useFileAttachments(pluginName, entityId);

  const [libraryFiles, setLibraryFiles] = useState<FileItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    attachmentId: string;
    displayName: string;
  } | null>(null);

  const disabled = entityId === null || entityId === undefined || entityId === '';

  const attachedIds = useMemo(
    () => new Set(attachments.map((a) => a.file.id).filter(Boolean)),
    [attachments],
  );

  const addableFiles = useMemo(
    () => libraryFiles.filter((f) => f.id && !attachedIds.has(String(f.id))),
    [libraryFiles, attachedIds],
  );

  const filteredFileSuggestions = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) {
      return addableFiles;
    }
    return addableFiles.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const id = String(f.id).toLowerCase();
      const mime = (f.mimeType || '').toLowerCase();
      return name.includes(q) || id.includes(q) || mime.includes(q);
    });
  }, [addableFiles, fileSearch]);

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const raw = await filesApi.getItems();
      setLibraryFiles(normalizeLibraryFiles(raw));
    } catch {
      setLibraryFiles([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (readOnly || disabled) {
      return;
    }
    void loadLibrary();
  }, [readOnly, disabled, attachments.length, loadLibrary]);

  useEffect(() => {
    if (addableFiles.length === 0) {
      setFilePickerOpen(false);
    }
  }, [addableFiles.length]);

  const onPickFiles = () => {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) {
      return;
    }
    const arr = Array.from(list);
    e.target.value = '';
    try {
      await upload(arr);
      void loadLibrary();
    } catch {
      /* error surfaced via hook state */
    }
  };

  const busy = uploading || attachingExisting;

  return (
    <Card padding="none" className={cn(CARD_CLASS, cardClassName, className)}>
      <div className="space-y-2 p-6">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {t('files.attachmentsTitle')}
          </span>
        </div>

        {!readOnly ? (
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFilesSelected}
            disabled={disabled || busy}
          />
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          </div>
        ) : null}

        {!readOnly ? (
          <div
            className={cn(
              'grid grid-cols-1 gap-2 md:grid-cols-2',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-medium">{t('files.attachmentsRowTitle')}</div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('files.attachmentsSectionHelp')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Upload}
                  disabled={disabled || busy}
                  onClick={onPickFiles}
                  className="h-9 shrink-0"
                >
                  {uploading ? t('files.attachmentsUploading') : t('files.attachmentsUploadButton')}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-medium">{t('files.attachmentsFromLibrary')}</div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('files.attachmentsFromLibraryHelp')}
                  </p>
                </div>
                <Popover
                  open={filePickerOpen && addableFiles.length > 0}
                  onOpenChange={setFilePickerOpen}
                >
                  <PopoverAnchor asChild>
                    <div className="relative w-full min-w-0 max-w-[180px] shrink-0">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={fileSearch}
                        onChange={(event) => {
                          setFileSearch(event.target.value);
                          setFilePickerOpen(true);
                        }}
                        onFocus={() => {
                          setFilePickerOpen(true);
                          if (libraryFiles.length === 0 && !libraryLoading) {
                            void loadLibrary();
                          }
                        }}
                        placeholder={
                          addableFiles.length === 0
                            ? libraryFiles.length === 0 && !libraryLoading
                              ? t('files.attachmentsNoFilesInLibrary')
                              : t('files.attachmentsAllAttached')
                            : t('files.attachmentsPickPlaceholder')
                        }
                        className="h-9 bg-background pl-9 text-xs"
                        disabled={disabled || busy || addableFiles.length === 0}
                        aria-busy={libraryLoading}
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    sideOffset={6}
                    className="z-[120] w-[var(--radix-popover-anchor-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                  >
                    {libraryLoading ? (
                      <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                        {t('common.loading')}
                      </div>
                    ) : filteredFileSuggestions.length > 0 ? (
                      filteredFileSuggestions.map((file) => {
                        const displayName = file.name?.trim() ? file.name : file.id;
                        const meta = [formatSize(file.size ?? undefined), file.mimeType]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <button
                            key={file.id}
                            type="button"
                            className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                            onClick={async () => {
                              try {
                                await attachExisting(file.id);
                                setFileSearch('');
                                setFilePickerOpen(false);
                                void loadLibrary();
                              } catch {
                                /* error on hook */
                              }
                            }}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium">
                                {displayName}
                              </span>
                              {meta ? (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {meta}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                        {fileSearch.trim()
                          ? t('files.attachmentsNoSearchResults')
                          : t('files.attachmentsPickPlaceholder')}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{t('files.attachmentsEmpty')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map((row) => {
              const file = row.file;
              if (!file?.id) {
                return null;
              }
              const displayName = file.name?.trim() ? file.name : file.id;
              const meta = [formatSize(file.size ?? undefined), file.mimeType]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={row.attachmentId}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm font-medium">{displayName}</div>
                    {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a
                      href={filesApi.getFileDownloadUrl(file.id)}
                      download={displayName || undefined}
                      rel="noreferrer"
                      aria-label={t('files.attachmentsDownload')}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'h-9 w-9 shrink-0 p-0 inline-flex items-center justify-center',
                      )}
                    >
                      <Download className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="sr-only">{t('files.attachmentsDownload')}</span>
                    </a>
                    <a
                      href={filesApi.getFileDownloadUrl(file.id, { inline: true })}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('files.attachmentsOpenInNewTab')}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'h-9 w-9 shrink-0 p-0 inline-flex items-center justify-center',
                      )}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="sr-only">{t('files.attachmentsOpenInNewTab')}</span>
                    </a>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="h-9 w-9 shrink-0 p-0 text-destructive hover:text-destructive"
                        onClick={() =>
                          setRemoveTarget({
                            attachmentId: row.attachmentId,
                            displayName,
                          })
                        }
                        aria-label={t('files.attachmentsRemove')}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={removeTarget !== null}
        title={t('files.attachmentsRemoveDialogTitle')}
        message={
          removeTarget
            ? t('files.attachmentsRemoveDialogMessage', { name: removeTarget.displayName })
            : ''
        }
        confirmText={t('files.attachmentsRemove')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (!removeTarget) {
            return;
          }
          void detach(removeTarget.attachmentId);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </Card>
  );
}
