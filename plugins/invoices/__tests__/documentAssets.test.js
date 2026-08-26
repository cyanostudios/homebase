const { displayNameFromEmail } = require('../documentAssets');

describe('displayNameFromEmail', () => {
  it('formats local-part with dots/underscores', () => {
    expect(displayNameFromEmail('mario.nasr@homebase.se')).toBe('Mario Nasr');
    expect(displayNameFromEmail('richard_kanebo@example.com')).toBe('Richard Kanebo');
  });

  it('returns empty for missing email', () => {
    expect(displayNameFromEmail('')).toBe('');
    expect(displayNameFromEmail(null)).toBe('');
    expect(displayNameFromEmail(undefined)).toBe('');
  });
});
