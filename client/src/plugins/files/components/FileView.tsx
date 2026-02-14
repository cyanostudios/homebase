import { ExternalLink, File, FileText, Image as ImageIcon } from 'lucide-react';
import React, { useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import type { FileItem } from '../types/files';

type Props = {
  file?: FileItem; // passed by panelRendering as singular prop
  item?: FileItem; // generic fallback
};

function humanSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export const FileView: React.FC<Props> = ({ file, item }) => {
  const f = (file ?? item) as FileItem | undefined;

  const isImage = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt.startsWith('image/');
  }, [f?.mimeType]);

  const isPdf = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt === 'application/pdf' || (f?.url || '').toLowerCase().endsWith('.pdf');
  }, [f?.mimeType, f?.url]);

  if (!f) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-50">
        <File className="w-12 h-12 mb-4" />
        <p className="text-sm font-medium">No file selected.</p>
      </div>
    );
  }

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-6">
          <Card
            padding="none"
            className="overflow-hidden border-none shadow-sm bg-background/50 plugin-files"
          >
            <DetailSection title="Information" className="p-4">
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center group">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {f.mimeType || 'application/octet-stream'}
                  </span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-medium">{humanSize(f.size)}</span>
                </div>
                {f.url && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-muted-foreground">Source URL</span>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-medium break-all flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      View Original
                    </a>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono font-medium opacity-70">
                      {formatDisplayNumber('files', f.id)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium font-mono text-[10px] opacity-70">
                      {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium font-mono text-[10px] opacity-70">
                      {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Preview Area */}
        {f.url ? (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection
              title={isImage ? 'Image Preview' : isPdf ? 'PDF Preview' : 'File Content'}
              className="p-6"
            >
              {isImage ? (
                <div className="rounded-lg overflow-hidden border border-border/50 shadow-inner bg-muted/20 flex items-center justify-center min-h-[200px]">
                  <img src={f.url} alt={f.name || 'image'} className="max-w-full h-auto" />
                </div>
              ) : isPdf ? (
                <div className="rounded-lg overflow-hidden border border-border/50 shadow-inner bg-muted/20">
                  <iframe
                    src={f.url}
                    title={f.name || 'pdf'}
                    className="w-full"
                    style={{ minHeight: 600 }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-60">
                  <FileText className="w-12 h-12 mb-4" />
                  <p className="text-sm">No inline preview available for this file type.</p>
                  <p className="text-xs mt-1">Please use the external link to view or download.</p>
                </div>
              )}
            </DetailSection>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Preview Unavailable" className="p-6">
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-60">
                <ImageIcon className="w-12 h-12 mb-4" />
                <p className="text-sm">No URL associated with this file record.</p>
              </div>
            </DetailSection>
          </Card>
        )}
      </div>
    </DetailLayout>
  );
};
