export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
  /** Extra header labels for auto-mapping (e.g. translated export columns). */
  aliases?: string[];
}

export interface ImportSchema {
  fields: ImportField[];
}

export interface ImportResult {
  successCount: number;
  failureCount: number;
  /** Optional breakdown shown in the result step when rows fail. */
  failureMessages?: string[];
}

/** Soft limits (ADR TABULAR_IMPORT_EXPORT). */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_DATA_ROWS = 2000;

export type ImportLimitErrorCode = 'empty' | 'too_large' | 'too_many_rows' | 'invalid_format';

export type DelimiterChar = ',' | ';' | '\t';

/** Strip BOM and normalize header text for matching. */
export function normalizeImportHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

/** Pick delimiter from the first line (tabs, semicolons, or commas). */
export function detectDelimiter(firstLine: string): DelimiterChar {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  if (tabCount > 0 && tabCount >= commaCount && tabCount >= semicolonCount) {
    return '\t';
  }
  if (semicolonCount > commaCount) {
    return ';';
  }
  return ',';
}

/**
 * Robust delimiter parser that handles quoted values, escaped quotes, and multiline cells.
 */
export function parseDelimitedText(text: string, delimiter: DelimiterChar = ','): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const normalizedText = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];
    const next = normalizedText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
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

  if (current !== '' || row.length > 0) {
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Robust CSV parser that handles quoted values, escaped quotes, and multiline cells.
 */
export function parseCSV(text: string): string[][] {
  return parseDelimitedText(text, ',');
}

/** Parse CSV/TSV/semicolon text using the delimiter detected from the header line. */
export function parseDelimitedGrid(text: string): string[][] {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return [];
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  if (delimiter === '\t') {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.split('\t').map((cell) => cell.replace(/^\uFEFF/, '').trim()));
  }

  return parseDelimitedText(trimmed, delimiter);
}

/**
 * Parse pasted tabular text (TSV if tabs dominate the header line, otherwise CSV).
 */
export function parseTabularPaste(text: string): string[][] {
  return parseDelimitedGrid(text);
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
  const [headerRow, ...rows] = csvData;
  if (!headerRow) {
    return [];
  }

  const headerLen = headerRow.length;

  return rows.map((row) => {
    const padded = [...row];
    while (padded.length < headerLen) {
      padded.push('');
    }

    const obj: Record<string, string> = {};
    Object.entries(mapping).forEach(([fieldKey, csvIndex]) => {
      if (csvIndex !== -1 && csvIndex < padded.length) {
        obj[fieldKey] = String(padded[csvIndex] ?? '').trim();
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
    const index = headers.findIndex((header) => headerMatchesField(header, field));
    initialMapping[field.key] = index;
  });
  return initialMapping;
}

function headerMatchesField(header: string, field: ImportField): boolean {
  const normalized = normalizeImportHeader(header);
  if (!normalized) {
    return false;
  }
  const candidates = [field.label, field.key, ...(field.aliases ?? [])].map((value) =>
    normalizeImportHeader(value),
  );

  return candidates.some((candidate) => candidate === normalized);
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
  exampleRows?: Record<string, string>[],
): string {
  const headers = schema.fields.map((f) => f.label);
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rows = exampleRows?.length ? exampleRows : [exampleRow];
  const dataLines = rows.map((row) =>
    schema.fields
      .map((f) => row[f.key] ?? '')
      .map(escapeCsvCell)
      .join(','),
  );
  return `${headerLine}\n${dataLines.join('\n')}\n`;
}

/**
 * Download a CSV import template derived from ImportSchema labels + optional example row.
 */
export function downloadImportCsvTemplate(options: {
  schema: ImportSchema;
  filename: string;
  exampleRow?: Record<string, string>;
  exampleRows?: Record<string, string>[];
}): void {
  const { schema, filename, exampleRow = {}, exampleRows } = options;
  if (!schema.fields.length) {
    return;
  }

  const csvContent = buildImportCsvTemplateContent(schema, exampleRow, exampleRows);
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
