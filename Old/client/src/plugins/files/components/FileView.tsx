// client/src/plugins/files/components/FileView.tsx
import React, { useMemo } from 'react';
import { Download, File as FileIcon, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import type { FileItem } from '../types/files';

type Props = {
  file?: FileItem;      // passed by panelRendering as singular prop
  item?: FileItem;      // generic fallback
};

function humanSize(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
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
      <div className="p-6 text-sm text-gray-600">
        No file selected.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <Heading level={2}>{f.name || 'Untitled file'}</Heading>
        <Text variant="caption" className="text-gray-500">
          {f.mimeType || 'application/octet-stream'} • {humanSize(f.size)}
        </Text>
      </div>

      <Card className="mb-4">
        <div className="p-4 flex items-center gap-3">
          <FileIcon className="w-5 h-5 text-gray-500" />
          <div className="text-sm text-gray-700 break-all">
            <div><span className="text-gray-500">ID:</span> {f.id}</div>
            {f.url && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-500" />
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {f.url}
                </a>
              </div>
            )}
          </div>
          {f.url && (
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
              title="Download"
            >
              <Download className="w-4 h-4 mr-1" /> Download
            </a>
          )}
        </div>
      </Card>

      {/* Preview */}
      {f.url ? (
        isImage ? (
          <Card>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2 text-gray-600 text-sm">
                <ImageIcon className="w-4 h-4" />
                Image preview
              </div>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.name || 'image'} className="w-full h-auto" />
              </div>
            </div>
          </Card>
        ) : isPdf ? (
          <Card>
            <div className="p-3">
              <div className="text-gray-600 text-sm mb-2">PDF preview</div>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <iframe
                  src={f.url}
                  title={f.name || 'pdf'}
                  className="w-full"
                  style={{ minHeight: 520 }}
                />
              </div>
            </div>
          </Card>
        ) : (
          <Text variant="caption" className="text-gray-500">
            No inline preview available for this file type. Use Download to open it.
          </Text>
        )
      ) : (
        <Text variant="caption" className="text-gray-500">
          No URL set for this file.
        </Text>
      )}
    </div>
  );
};
