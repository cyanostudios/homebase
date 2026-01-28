// client/src/core/utils/exportUtils.ts
// Export utilities for CSV and PDF generation

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
