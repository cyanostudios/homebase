// client/src/plugins/files/components/FileView.tsx
import React, { useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { Text } from '@/core/ui/Typography';

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
    return <div className="p-6 text-sm text-gray-600">No file selected.</div>;
  }

  return (
    <div className="space-y-4">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="File Details">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Name</div>
              <div className="text-sm font-medium text-foreground">{f.name || 'Untitled file'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="text-sm text-foreground">
                {f.mimeType || 'application/octet-stream'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Size</div>
              <div className="text-sm text-foreground">{humanSize(f.size)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ID</div>
              <div className="text-sm font-mono text-foreground">{f.id}</div>
            </div>
            {f.url && (
              <div>
                <div className="text-xs text-muted-foreground">URL</div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 underline break-all"
                >
                  {f.url}
                </a>
              </div>
            )}
          </div>
        </DetailSection>
      </Card>

      {/* Preview */}
      {f.url ? (
        isImage ? (
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="Image Preview">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/50">
                <img src={f.url} alt={f.name || 'image'} className="w-full h-auto" />
              </div>
            </DetailSection>
          </Card>
        ) : isPdf ? (
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="PDF Preview">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/50">
                <iframe
                  src={f.url}
                  title={f.name || 'pdf'}
                  className="w-full"
                  style={{ minHeight: 520 }}
                />
              </div>
            </DetailSection>
          </Card>
        ) : (
          <Text variant="caption" className="text-muted-foreground">
            No inline preview available for this file type. Use Download to open it.
          </Text>
        )
      ) : (
        <Text variant="caption" className="text-muted-foreground">
          No URL set for this file.
        </Text>
      )}
    </div>
  );
};
