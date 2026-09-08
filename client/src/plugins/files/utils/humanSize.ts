// client/src/plugins/files/utils/humanSize.ts
export function humanSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function getMimeLabel(mimeType?: string | null): string | null {
  if (!mimeType) {
    return null;
  }
  if (mimeType.startsWith('image/')) {
    return mimeType.replace('image/', '').toUpperCase();
  }
  if (mimeType.includes('pdf')) {
    return 'PDF';
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return 'DOCX';
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return 'XLSX';
  }
  const sub = mimeType.split('/').pop();
  return sub ? sub.toUpperCase() : null;
}
