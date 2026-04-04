import { useCallback, useEffect, useState } from 'react';

import { filesApi } from '@/plugins/files/api/filesApi';
import type { FileAttachmentEntry } from '@/plugins/files/types/files';

function normalizeAttachmentList(raw: unknown): FileAttachmentEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((row): row is FileAttachmentEntry => {
    if (!row || typeof row !== 'object') {
      return false;
    }
    const r = row as FileAttachmentEntry;
    const id = r.attachmentId;
    const file = r.file;
    return (
      typeof id === 'string' &&
      !!file &&
      typeof file === 'object' &&
      typeof (file as { id?: unknown }).id === 'string'
    );
  });
}

export function useFileAttachments(
  pluginName: string,
  entityId: string | number | null | undefined,
) {
  const [attachments, setAttachments] = useState<FileAttachmentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachingExisting, setAttachingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityKey =
    entityId !== null && entityId !== undefined && entityId !== '' ? String(entityId) : '';

  const refresh = useCallback(async () => {
    if (!entityKey || !pluginName) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await filesApi.listAttachments(pluginName, entityKey);
      setAttachments(normalizeAttachmentList(list));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load attachments';
      setError(msg);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [pluginName, entityKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!entityKey || !pluginName || !files.length) {
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const created = await filesApi.uploadFiles(files);
        const uploaded = Array.isArray(created) ? created : [];
        for (const item of uploaded) {
          if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) {
            continue;
          }
          await filesApi.createAttachment({
            pluginName,
            entityId: entityKey,
            fileId: String(item.id),
          });
        }
        await refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setError(msg);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [pluginName, entityKey, refresh],
  );

  const detach = useCallback(async (attachmentId: string) => {
    setError(null);
    try {
      await filesApi.deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.attachmentId !== attachmentId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to remove attachment';
      setError(msg);
      throw e;
    }
  }, []);

  const attachExisting = useCallback(
    async (fileId: string) => {
      if (!entityKey || !pluginName || !fileId) {
        return;
      }
      setAttachingExisting(true);
      setError(null);
      try {
        await filesApi.createAttachment({
          pluginName,
          entityId: entityKey,
          fileId: String(fileId),
        });
        await refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to attach file';
        setError(msg);
        throw e;
      } finally {
        setAttachingExisting(false);
      }
    },
    [pluginName, entityKey, refresh],
  );

  return {
    attachments,
    loading,
    uploading,
    attachingExisting,
    error,
    refresh,
    upload,
    attachExisting,
    detach,
  };
}
