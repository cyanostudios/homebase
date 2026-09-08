import { getMimeLabel, humanSize } from '../humanSize';

describe('humanSize', () => {
  it('formats bytes', () => {
    expect(humanSize(null)).toBe('—');
    expect(humanSize(500)).toBe('500 B');
    expect(humanSize(2048)).toBe('2.0 KB');
  });
});

describe('getMimeLabel', () => {
  it('labels common types', () => {
    expect(getMimeLabel('image/png')).toBe('PNG');
    expect(getMimeLabel('application/pdf')).toBe('PDF');
    expect(getMimeLabel(null)).toBeNull();
  });
});
