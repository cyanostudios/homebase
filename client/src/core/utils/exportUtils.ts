// client/src/core/utils/exportUtils.ts
// Export utilities for CSV, PDF and TXT generation

export type ExportFormat = 'txt' | 'csv' | 'pdf';

/** Config for the unified exportItems API. Plugin supplies format-specific builders. */
export interface ExportFormatConfig {
  txt?: {
    getContent: (item: any) => string;
    getFilename: (item: any) => string;
    /** When exporting multiple items as one file (e.g. list export). */
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
  /** Base filename (without extension) when format is csv/pdf or txt multi-file. */
  filename?: string;
  /** PDF title (used when format is pdf). */
  title?: string;
}

/**
 * Export items to a single TXT file (one file per item downloaded in sequence, or one concatenated file).
 */
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

/**
 * Export data to TXT: one file per item (single item) or one concatenated file (multiple items).
 */
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
  const txtConfig = { getContent, getFilename, baseFilename };
  if (items.length === 1) {
    const content = getContent(items[0]);
    const filename = getFilename(items[0]);
    downloadTxtBlob(content, filename);
    return;
  }
  if (baseFilename) {
    const separator = '\n\n---\n\n';
    const content = items.map((item) => getContent(item)).join(separator);
    downloadTxtBlob(content, baseFilename);
    return;
  }
  // Multiple items, no baseFilename: download first only (fallback)
  const content = getContent(items[0]);
  const filename = getFilename(items[0]);
  downloadTxtBlob(content, filename);
}

/**
 * Unified export entry point. Dispatches to exportToTxt, exportToCSV, or exportToPDF based on format.
 * Returns a Promise when format is pdf (for await), void otherwise.
 */
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
      if (!c?.getContent || !c?.getFilename) {
        console.warn('Export format "txt" requires config.txt.getContent and config.txt.getFilename');
        return;
      }
      exportToTxt(items, c.getContent, c.getFilename, items.length > 1 ? c.baseFilename ?? baseFilename : undefined);
      return;
    }
    case 'csv': {
      const c = config.csv;
      if (!c?.headers || !c?.mapItemToRow) {
        console.warn('Export format "csv" requires config.csv.headers and config.csv.mapItemToRow');
        return;
      }
      const data = items.map((item) => c.mapItemToRow(item));
      exportToCSV(data, baseFilename, c.headers);
      return;
    }
    case 'pdf': {
      const c = config.pdf;
      if (!c?.columns || !c?.mapItemToRow) {
        console.warn('Export format "pdf" requires config.pdf.columns and config.pdf.mapItemToRow');
        return;
      }
      const data = items.map((item) => c.mapItemToRow(item));
      const title = c.title ?? optionsTitle ?? 'Export';
      return exportToPDF(data, baseFilename, c.columns, title);
    }
    default:
      console.warn(`Unknown export format: ${format}`);
  }
}

/**
 * Escape CSV value to handle special characters
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: any[], headers: string[]): string {
  // Create header row
  const headerRow = headers.map(escapeCSVValue).join(',');

  // Create data rows
  const dataRows = data.map((item) => {
    return headers
      .map((header) => {
        const value = item[header];
        return escapeCSVValue(value);
      })
      .join(',');
  });

  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Export data to CSV file
 */
export function exportToCSV(data: any[], filename: string, headers: string[]): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Convert data to CSV
  const csvContent = convertToCSV(data, headers);

  // Add BOM for UTF-8 to ensure Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for display
 */
function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD format
  } catch {
    return '';
  }
}

/**
 * Format date and time for display
 */
function _formatDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleString('sv-SE'); // YYYY-MM-DD HH:mm:ss format
  } catch {
    return '';
  }
}

/**
 * Truncate string for PDF cell (max chars)
 */
function truncateForCell(value: string, maxLen: number = 25): string {
  if (!value) {
    return '';
  }
  const s = String(value).trim();
  return s.length > maxLen ? s.slice(0, maxLen - 2) + '…' : s;
}

/**
 * Export data to PDF file using jsPDF directly (no html2canvas)
 */
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

    const exportDate = new Date().toLocaleString('sv-SE');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Exported: ${exportDate} | Total records: ${data.length}`, startX, y);
    y += lineHeight + 4;

    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);

    // Column widths (landscape A4 ~297mm, minus margins = ~273mm)
    const numCols = headers.length;
    const colWidth = (pageWidth - 2 * margin) / numCols;

    // Helper: check if we need a new page
    const addPageIfNeeded = (requiredSpace: number) => {
      if (y + requiredSpace > pageHeight - margin) {
        doc.addPage('a4', 'landscape');
        y = margin;
      }
    };

    // Header row
    doc.setFont(undefined, 'bold');
    doc.setFontSize(headerFontSize);
    let x = startX;
    headers.forEach((h) => {
      doc.text(truncateForCell(h.label, 20), x + cellPadding, y + cellPadding);
      x += colWidth;
    });
    y += lineHeight + cellPadding * 2;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(fontSize);

    // Horizontal line under header
    doc.setDrawColor(200, 200, 200);
    doc.line(startX, y, pageWidth - margin, y);
    y += 2;

    // Data rows
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
        if (value === null || value === undefined) {
          value = '';
        }
        doc.text(truncateForCell(String(value), 22), x + cellPadding, y + cellPadding);
        x += colWidth;
      });
      y += lineHeight + cellPadding * 2;
    }

    const outputFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    doc.save(outputFilename);
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}
