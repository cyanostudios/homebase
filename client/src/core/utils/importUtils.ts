export interface ImportField {
    key: string;
    label: string;
    required?: boolean;
    type?: 'string' | 'number' | 'date' | 'boolean';
}

export interface ImportSchema {
    fields: ImportField[];
}

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
 * Maps CSV rows to objects based on a header index mapping.
 */
export function mapCsvToObjects(csvData: string[][], mapping: Record<string, number>): any[] {
    const [headers, ...rows] = csvData;
    if (!headers) return [];

    return rows.map((row) => {
        const obj: any = {};
        Object.entries(mapping).forEach(([fieldKey, csvIndex]) => {
            if (csvIndex !== -1 && row[csvIndex] !== undefined) {
                obj[fieldKey] = row[csvIndex];
            }
        });
        return obj;
    });
}
