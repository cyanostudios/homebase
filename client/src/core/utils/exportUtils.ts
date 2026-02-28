// client/src/core/utils/exportUtils.ts
// Export utilities for CSV, PDF and TXT generation

export type ExportFormat = 'txt' | 'csv' | 'pdf';

/** Config for the unified exportItems API. Plugin supplies format-specific builders. */
export interface ExportFormatConfig {
  txt?: {
    getContent: (item: any) => string;
    getFilename: (item: any) => string;
    baseFilename?: string;
  };
  csv?: {
    headers: string[];
    mapItemToRow: (item: any) => Record<string, any>;
  };
  pdf?: {
    columns: { key: string; label: string }[];
    mapItemToRow: (item: any) => Record<string, any>;
    title?: string;
  };
}

export interface ExportItemsOptions {
  items: any[];
  format: ExportFormat;
  config: ExportFormatConfig;
  filename?: string;
  title?: string;
}

function downloadTxtBlob(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToTxt(
  items: any[],
  getContent: (item: any) => string,
  getFilename: (item: any) => string,
  baseFilename?: string,
): void {
  if (!items || items.length === 0) {
    alert('No data to export');
    return;
  }
  if (items.length === 1) {
    downloadTxtBlob(getContent(items[0]), getFilename(items[0]));
    return;
  }
  if (baseFilename) {
    const content = items.map((item) => getContent(item)).join('\n\n---\n\n');
    downloadTxtBlob(content, baseFilename);
    return;
  }
  downloadTxtBlob(getContent(items[0]), getFilename(items[0]));
}

export function exportItems(options: ExportItemsOptions): void | Promise<void> {
  const { items, format, config, filename: optionsFilename, title: optionsTitle } = options;
  if (!items || items.length === 0) {
    alert('No data to export');
    return;
  }
  const baseFilename = optionsFilename ?? `export-${new Date().toISOString().split('T')[0]}`;

  switch (format) {
    case 'txt': {
      const c = config.txt;
      if (!c?.getContent || !c?.getFilename) return;
      exportToTxt(
        items,
        c.getContent,
        c.getFilename,
        items.length > 1 ? (c.baseFilename ?? baseFilename) : undefined,
      );
      return;
    }
    case 'csv': {
      const c = config.csv;
      if (!c?.headers || !c?.mapItemToRow) return;
      exportToCSV(items.map((item) => c.mapItemToRow(item)), baseFilename, c.headers);
      return;
    }
    case 'pdf': {
      const c = config.pdf;
      if (!c?.columns || !c?.mapItemToRow) return;
      const data = items.map((item) => c.mapItemToRow(item));
      const title = c.title ?? optionsTitle ?? 'Export';
      return exportToPDF(data, baseFilename, c.columns, title);
    }
    default:
      console.warn(`Unknown export format: ${format}`);
  }
}

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.map(escapeCSVValue).join(',');
  const dataRows = data.map((item) =>
    headers.map((h) => escapeCSVValue(item[h])).join(','),
  );
  return [headerRow, ...dataRows].join('\n');
}

export function exportToCSV(data: any[], filename: string, headers: string[]): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + convertToCSV(data, headers)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

function truncateForCell(value: string, maxLen: number = 25): string {
  if (!value) return '';
  const s = String(value).trim();
  return s.length > maxLen ? s.slice(0, maxLen - 2) + '…' : s;
}

export async function exportToPDF(
  data: any[],
  filename: string,
  headers: { key: string; label: string }[],
  title: string = 'Export',
): Promise<void> {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const startX = margin;
    let y = margin;
    const lineHeight = 6;
    const cellPadding = 3;
    const fontSize = 9;
    const headerFontSize = 10;

    doc.setFontSize(14);
    doc.text(title, startX, y);
    y += lineHeight + 2;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Exported: ${new Date().toLocaleString('sv-SE')} | Total records: ${data.length}`,
      startX,
      y,
    );
    y += lineHeight + 4;
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    const numCols = headers.length;
    const colWidth = (pageWidth - 2 * margin) / numCols;
    const addPageIfNeeded = (required: number) => {
      if (y + required > pageHeight - margin) {
        doc.addPage('a4', 'landscape');
        y = margin;
      }
    };

    doc.setFont(doc.getFont().fontName, 'bold');
    doc.setFontSize(headerFontSize);
    let x = startX;
    headers.forEach((h) => {
      doc.text(truncateForCell(h.label, 20), x + cellPadding, y + cellPadding);
      x += colWidth;
    });
    y += lineHeight + cellPadding * 2;
    doc.setFont(doc.getFont().fontName, 'normal');
    doc.setFontSize(fontSize);
    doc.setDrawColor(200, 200, 200);
    doc.line(startX, y, pageWidth - margin, y);
    y += 2;

    for (let i = 0; i < data.length; i++) {
      addPageIfNeeded(lineHeight + cellPadding * 2 + 4);
      const row = data[i];
      x = startX;
      headers.forEach((h) => {
        let value = row[h.key];
        if (
          value instanceof Date ||
          (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))
        ) {
          value = formatDate(value);
        }
        if (value === null || value === undefined) value = '';
        doc.text(truncateForCell(String(value), 22), x + cellPadding, y + cellPadding);
        x += colWidth;
      });
      y += lineHeight + cellPadding * 2;
    }
    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}
