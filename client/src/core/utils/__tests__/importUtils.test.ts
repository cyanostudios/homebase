import {
  parseCSV,
  parseDelimitedGrid,
  parseTabularPaste,
  parseXlsxArrayBuffer,
  checkImportLimits,
  mapCsvToObjects,
  buildAutoMapping,
  areRequiredFieldsMapped,
  buildImportCsvTemplateContent,
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_FILE_BYTES,
} from '../importUtils';

describe('parseCSV', () => {
  it('parses simple CSV with header', () => {
    const grid = parseCSV('Name,Email\nAcme,a@b.c\n');
    expect(grid).toEqual([
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ]);
  });

  it('handles quoted commas', () => {
    const grid = parseCSV('Name,Notes\n"Acme, Inc",hello\n');
    expect(grid[1]).toEqual(['Acme, Inc', 'hello']);
  });
});

describe('parseDelimitedGrid', () => {
  it('parses semicolon-separated CSV (common Excel export in SV)', () => {
    const grid = parseDelimitedGrid('Article;Brand\nJersey;Nike\n');
    expect(grid).toEqual([
      ['Article', 'Brand'],
      ['Jersey', 'Nike'],
    ]);
  });

  it('strips BOM from headers for auto-mapping', () => {
    const grid = parseDelimitedGrid('\uFEFFArticle,Brand\nJersey,Nike\n');
    const schema = {
      fields: [{ key: 'articleName', label: 'Article', required: true }],
    };
    expect(buildAutoMapping(grid[0], schema)).toEqual({ articleName: 0 });
  });
});

describe('parseTabularPaste', () => {
  it('parses TSV when tabs dominate', () => {
    const grid = parseTabularPaste('Name\tEmail\nAcme\ta@b.c');
    expect(grid).toEqual([
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ]);
  });

  it('parses CSV paste', () => {
    const grid = parseTabularPaste('Name,Email\nAcme,a@b.c');
    expect(grid).toEqual([
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ]);
  });

  it('returns empty for whitespace', () => {
    expect(parseTabularPaste('  \n  ')).toEqual([]);
  });
});

describe('parseXlsxArrayBuffer', () => {
  it('reads first sheet as string grid', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
    const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const grid = await parseXlsxArrayBuffer(buffer);
    expect(grid).toEqual([
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ]);
  });
});

describe('checkImportLimits', () => {
  it('rejects oversized files', () => {
    expect(
      checkImportLimits({
        fileSizeBytes: IMPORT_MAX_FILE_BYTES + 1,
        grid: [['a'], ['b']],
      }),
    ).toBe('too_large');
  });

  it('rejects empty grids', () => {
    expect(checkImportLimits({ grid: [] })).toBe('empty');
    expect(checkImportLimits({ grid: [['Name']] })).toBe('empty');
  });

  it('rejects too many data rows', () => {
    const grid = [['h'], ...Array.from({ length: IMPORT_MAX_DATA_ROWS + 1 }, () => ['x'])];
    expect(checkImportLimits({ grid })).toBe('too_many_rows');
  });

  it('accepts valid grid', () => {
    expect(checkImportLimits({ grid: [['Name'], ['Acme']] })).toBeNull();
  });
});

describe('mapCsvToObjects / mapping helpers', () => {
  const schema = {
    fields: [
      { key: 'companyName', label: 'Name', required: true },
      { key: 'email', label: 'Email' },
    ],
  };

  it('maps by column index', () => {
    const grid = [
      ['Name', 'Email'],
      ['Acme', 'a@b.c'],
    ];
    const mapping = buildAutoMapping(grid[0], schema);
    expect(mapping).toEqual({ companyName: 0, email: 1 });
    expect(mapCsvToObjects(grid, mapping)).toEqual([{ companyName: 'Acme', email: 'a@b.c' }]);
  });

  it('pads short rows and trims mapped cells', () => {
    const grid = [
      ['Name', 'Email', 'Notes'],
      ['Acme', 'a@b.c'],
    ];
    const mapping = { companyName: 0, email: 1, notes: 2 };
    expect(mapCsvToObjects(grid, mapping)).toEqual([
      { companyName: 'Acme', email: 'a@b.c', notes: '' },
    ]);
  });

  it('matches header aliases', () => {
    const schema = {
      fields: [{ key: 'articleName', label: 'Article', aliases: ['Artikel'] }],
    };
    expect(buildAutoMapping(['Artikel', 'Brand'], schema)).toEqual({
      articleName: 0,
    });
  });

  it('detects missing required mapping', () => {
    expect(areRequiredFieldsMapped(schema, { companyName: -1, email: 0 })).toBe(false);
    expect(areRequiredFieldsMapped(schema, { companyName: 0, email: -1 })).toBe(true);
  });
});

describe('buildImportCsvTemplateContent', () => {
  const schema = {
    fields: [
      { key: 'companyName', label: 'Name', required: true },
      { key: 'email', label: 'Email' },
      { key: 'notes', label: 'Notes' },
    ],
  };

  it('uses field labels as headers and example values by key', () => {
    const csv = buildImportCsvTemplateContent(schema, {
      companyName: 'Acme AB',
      email: 'info@acme.se',
      notes: 'Imported sample',
    });
    expect(csv).toBe('Name,Email,Notes\nAcme AB,info@acme.se,Imported sample\n');
  });

  it('escapes commas and quotes in cells', () => {
    const csv = buildImportCsvTemplateContent(schema, {
      companyName: 'Acme, Inc',
      email: 'a@b.c',
      notes: 'Say "hello"',
    });
    expect(csv).toBe('Name,Email,Notes\n"Acme, Inc",a@b.c,"Say ""hello"""\n');
  });

  it('produces headers that auto-map to schema keys', () => {
    const csv = buildImportCsvTemplateContent(schema, {
      companyName: 'Acme',
      email: 'a@b.c',
    });
    const grid = parseCSV(csv);
    const mapping = buildAutoMapping(grid[0], schema);
    expect(mapping).toEqual({ companyName: 0, email: 1, notes: 2 });
    expect(mapCsvToObjects(grid, mapping)[0]).toEqual({
      companyName: 'Acme',
      email: 'a@b.c',
      notes: '',
    });
  });

  it('supports multiple example rows', () => {
    const csv = buildImportCsvTemplateContent(schema, {}, [
      { companyName: 'Acme AB', email: 'info@acme.se', notes: 'First' },
      { companyName: 'Beta AB', email: 'hello@beta.se', notes: 'Second' },
    ]);
    expect(csv).toBe(
      'Name,Email,Notes\nAcme AB,info@acme.se,First\nBeta AB,hello@beta.se,Second\n',
    );
  });
});
