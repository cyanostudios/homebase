export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

export interface ImportSchema {
  fields: ImportField[];
}

export interface ImportResult {
  successCount: number;
  failureCount: number;
}

/** Soft limits (ADR TABULAR_IMPORT_EXPORT). */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_DATA_ROWS = 2000;

export type ImportLimitErrorCode = 'empty' | 'too_large' | 'too_many_rows' | 'invalid_format';

/**
 * Robust CSV parser that handles quoted values, escaped quotes, and multiline cells.
 */
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const next = normalizedText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current.trim());
        current = '';
      } else if (char === '\n') {
        row.push(current.trim());
        if (row.length > 0) {
          result.push(row);
        }
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Handle last row if not ending with newline
  if (current !== '' || row.length > 0) {
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Parse pasted tabular text (TSV if tabs dominate the header line, otherwise CSV).
 */
export function parseTabularPaste(text: string): string[][] {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return [];
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  if (tabCount > 0 && tabCount >= commaCount) {
    return trimmed.split(/\r?\n/).map((line) => line.split('\t').map((cell) => cell.trim()));
  }

  return parseCSV(trimmed);
}

/**
 * Parse first sheet of an .xlsx ArrayBuffer into a string grid (lazy-loads xlsx).
 */
export async function parseXlsxArrayBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  return rows.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    return cells.map((cell) => String(cell ?? '').trim());
  });
}

/**
 * Validate file size and grid row count. Returns an error code or null if OK.
 */
export function checkImportLimits(options: {
  fileSizeBytes?: number;
  grid: string[][];
}): ImportLimitErrorCode | null {
  if (options.fileSizeBytes != null && options.fileSizeBytes > IMPORT_MAX_FILE_BYTES) {
    return 'too_large';
  }

  if (!options.grid.length) {
    return 'empty';
  }

  const dataRows = Math.max(0, options.grid.length - 1);
  if (dataRows === 0) {
    return 'empty';
  }

  if (dataRows > IMPORT_MAX_DATA_ROWS) {
    return 'too_many_rows';
  }

  return null;
}

/**
 * Maps grid rows to objects based on a header index mapping.
 */
export function mapCsvToObjects(
  csvData: string[][],
  mapping: Record<string, number>,
): Record<string, string>[] {
  const [, ...rows] = csvData;
  if (!csvData[0]) {
    return [];
  }

  return rows.map((row) => {
    const obj: Record<string, string> = {};
    Object.entries(mapping).forEach(([fieldKey, csvIndex]) => {
      if (csvIndex !== -1 && row[csvIndex] !== undefined) {
        obj[fieldKey] = row[csvIndex];
      }
    });
    return obj;
  });
}

/** Alias for clarity at call sites that are format-agnostic. */
export const mapGridToObjects = mapCsvToObjects;

export function buildAutoMapping(headers: string[], schema: ImportSchema): Record<string, number> {
  const initialMapping: Record<string, number> = {};
  schema.fields.forEach((field) => {
    const index = headers.findIndex(
      (h) =>
        h.toLowerCase() === field.label.toLowerCase() ||
        h.toLowerCase() === field.key.toLowerCase(),
    );
    initialMapping[field.key] = index;
  });
  return initialMapping;
}

export function areRequiredFieldsMapped(
  schema: ImportSchema,
  mapping: Record<string, number>,
): boolean {
  return schema.fields.filter((f) => f.required).every((f) => (mapping[f.key] ?? -1) !== -1);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build CSV text for an import template (header = field labels for auto-mapping).
 * Pure — no DOM. Used by downloadImportCsvTemplate and tests.
 */
export function buildImportCsvTemplateContent(
  schema: ImportSchema,
  exampleRow: Record<string, string> = {},
): string {
  const headers = schema.fields.map((f) => f.label);
  const dataCells = schema.fields.map((f) => exampleRow[f.key] ?? '');
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLine = dataCells.map(escapeCsvCell).join(',');
  return `${headerLine}\n${dataLine}\n`;
}

/**
 * Download a CSV import template derived from ImportSchema labels + optional example row.
 */
export function downloadImportCsvTemplate(options: {
  schema: ImportSchema;
  filename: string;
  exampleRow?: Record<string, string>;
}): void {
  const { schema, filename, exampleRow = {} } = options;
  if (!schema.fields.length) {
    return;
  }

  const csvContent = buildImportCsvTemplateContent(schema, exampleRow);
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
