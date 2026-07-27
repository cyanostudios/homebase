import { getNamedBulkRows, retainFailedOrEmptyBulkRows } from '../teamsBulkCreate';

describe('teamsBulkCreate helpers', () => {
  const rows = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: '  ' },
    { id: '3', name: 'Beta' },
    { id: '4', name: '' },
  ];

  it('getNamedBulkRows ignores empty names', () => {
    expect(getNamedBulkRows(rows).map((row) => row.id)).toEqual(['1', '3']);
  });

  it('retainFailedOrEmptyBulkRows keeps empty rows and failed named rows', () => {
    const failed = new Set(['3']);
    expect(retainFailedOrEmptyBulkRows(rows, failed).map((row) => row.id)).toEqual(['2', '3', '4']);
  });
});
