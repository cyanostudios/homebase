import {
  buildInventoryImportFailureMessages,
  createEmptyInventoryImportFailureCounts,
  inventoryImportFailureTotal,
} from '../inventoryImportFailures';

describe('inventoryImportFailures', () => {
  const t = (key: string, options?: Record<string, string | number>) => {
    if (key === 'garments.importFailureEmptyArticle') {
      return `${options?.count} empty article cells`;
    }
    if (key === 'garments.importFailureDuplicateExamples') {
      return `${options?.count} duplicates: ${options?.examples}`;
    }
    return key;
  };

  it('totals all failure categories', () => {
    const counts = createEmptyInventoryImportFailureCounts();
    counts.emptyArticle = 94;
    counts.duplicate = 2;
    expect(inventoryImportFailureTotal(counts)).toBe(96);
  });

  it('builds human-readable failure messages', () => {
    const counts = createEmptyInventoryImportFailureCounts();
    counts.emptyArticle = 94;
    counts.duplicate = 1;
    counts.duplicateExamples = ['Match Jersey / Nike'];

    const messages = buildInventoryImportFailureMessages(counts, t);
    expect(messages[0]).toContain('94');
    expect(messages[1]).toContain('Match Jersey / Nike');
  });
});
