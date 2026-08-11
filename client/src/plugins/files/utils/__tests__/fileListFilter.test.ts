import {
  fileHasSize,
  fileIsImage,
  fileIsUpdatedWithinDays,
  fileMatchesListFilters,
  toggleFileListFilter,
} from '../fileListFilter';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');

describe('fileListFilter', () => {
  it('detects images, size, and recent updates', () => {
    expect(fileIsImage({ mimeType: 'image/png' })).toBe(true);
    expect(fileIsImage({ mimeType: 'application/pdf' })).toBe(false);
    expect(fileHasSize({ size: 10 })).toBe(true);
    expect(fileHasSize({ size: 0 })).toBe(false);
    expect(
      fileIsUpdatedWithinDays({ updatedAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000) }, 7, NOW),
    ).toBe(true);
    expect(
      fileIsUpdatedWithinDays({ updatedAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) }, 7, NOW),
    ).toBe(false);
  });

  it('ANDs facets; empty selection matches all', () => {
    const file = {
      mimeType: 'image/jpeg',
      size: 100,
      updatedAt: new Date(NOW - 24 * 60 * 60 * 1000),
    };
    expect(fileMatchesListFilters(file, [], NOW)).toBe(true);
    expect(fileMatchesListFilters(file, ['images', 'withSize'], NOW)).toBe(true);
    expect(fileMatchesListFilters({ ...file, size: 0 }, ['images', 'withSize'], NOW)).toBe(false);
  });

  it('toggles facets independently', () => {
    expect(toggleFileListFilter([], 'images')).toEqual(['images']);
    expect(toggleFileListFilter(['images'], 'updated7d')).toEqual(['images', 'updated7d']);
    expect(toggleFileListFilter(['images', 'updated7d'], 'images')).toEqual(['updated7d']);
  });
});
