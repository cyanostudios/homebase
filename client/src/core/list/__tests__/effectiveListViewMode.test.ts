import {
  getEffectiveCardColumnCount,
  getEffectiveColumnCount,
  getEffectiveListViewMode,
} from '../effectiveListViewMode';

describe('getEffectiveListViewMode', () => {
  it('forces cards on phone regardless of preference', () => {
    expect(getEffectiveListViewMode('table', 'phone')).toBe('cards');
    expect(getEffectiveListViewMode('cards', 'phone')).toBe('cards');
  });

  it('forces cards on pad regardless of preference', () => {
    expect(getEffectiveListViewMode('table', 'pad')).toBe('cards');
  });

  it('keeps table on desktop when preference is table', () => {
    expect(getEffectiveListViewMode('table', 'desktop')).toBe('table');
  });

  it('keeps cards on desktop when preference is cards', () => {
    expect(getEffectiveListViewMode('cards', 'desktop')).toBe('cards');
  });
});

describe('getEffectiveColumnCount', () => {
  it('forces 1 grid column on phone', () => {
    expect(getEffectiveColumnCount(2, 'phone')).toBe(1);
    expect(getEffectiveColumnCount(3, 'phone')).toBe(1);
  });

  it('clamps to max 2 columns on pad', () => {
    expect(getEffectiveColumnCount(1, 'pad')).toBe(1);
    expect(getEffectiveColumnCount(2, 'pad')).toBe(2);
    expect(getEffectiveColumnCount(3, 'pad')).toBe(2);
  });

  it('keeps preference on desktop', () => {
    expect(getEffectiveColumnCount(3, 'desktop')).toBe(3);
    expect(getEffectiveColumnCount(1, 'desktop')).toBe(1);
  });

  it('forces 2 columns on desktop when quick context is open', () => {
    expect(getEffectiveColumnCount(3, 'desktop', { quickContextOpen: true })).toBe(2);
    expect(getEffectiveColumnCount(3, 'desktop', { quickContextOpen: false })).toBe(3);
  });

  it('does not apply quick-context override on phone or pad', () => {
    expect(getEffectiveColumnCount(3, 'phone', { quickContextOpen: true })).toBe(1);
    expect(getEffectiveColumnCount(3, 'pad', { quickContextOpen: true })).toBe(2);
  });
});

describe('getEffectiveCardColumnCount', () => {
  it('forces column-2 card layout on phone', () => {
    expect(getEffectiveCardColumnCount(1, 'phone')).toBe(2);
    expect(getEffectiveCardColumnCount(3, 'phone')).toBe(2);
  });

  it('follows clamped column count on pad', () => {
    expect(getEffectiveCardColumnCount(1, 'pad')).toBe(1);
    expect(getEffectiveCardColumnCount(3, 'pad')).toBe(2);
  });

  it('keeps preference on desktop', () => {
    expect(getEffectiveCardColumnCount(1, 'desktop')).toBe(1);
    expect(getEffectiveCardColumnCount(3, 'desktop')).toBe(3);
  });

  it('forces 2 on desktop when quick context is open', () => {
    expect(getEffectiveCardColumnCount(3, 'desktop', { quickContextOpen: true })).toBe(2);
  });
});
