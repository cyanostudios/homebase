import {
  buildContactTagsSavePayload,
  hasContactTagsDraftChanges,
  mergeContactTag,
  resolveContactDisplayTags,
} from '../contactTagsDraft';

describe('contactTagsDraft', () => {
  it('resolveContactDisplayTags prefers draft when set', () => {
    expect(resolveContactDisplayTags(['a'], ['b', 'c'])).toEqual(['b', 'c']);
    expect(resolveContactDisplayTags(['a'], null)).toEqual(['a']);
    expect(resolveContactDisplayTags(undefined, null)).toEqual([]);
  });

  it('hasContactTagsDraftChanges detects add/remove/reorder', () => {
    expect(hasContactTagsDraftChanges(['a'], null)).toBe(false);
    expect(hasContactTagsDraftChanges(['a'], ['a'])).toBe(false);
    expect(hasContactTagsDraftChanges(['a'], ['a', 'b'])).toBe(true);
    expect(hasContactTagsDraftChanges(['a', 'b'], ['a'])).toBe(true);
    expect(hasContactTagsDraftChanges(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('buildContactTagsSavePayload includes next tags on contact', () => {
    const contact = { id: '1', companyName: 'Acme', tags: ['old'] };
    expect(buildContactTagsSavePayload(contact, ['vip', 'client'])).toEqual({
      id: '1',
      companyName: 'Acme',
      tags: ['vip', 'client'],
    });
  });

  it('mergeContactTag adds missing tags case-insensitively', () => {
    expect(mergeContactTag(['Vip'], 'vip')).toEqual(['Vip']);
    expect(mergeContactTag(['a'], 'b')).toEqual(['a', 'b']);
    expect(mergeContactTag(undefined, '  x  ')).toEqual(['x']);
    expect(mergeContactTag(['a'], '   ')).toEqual(['a']);
  });
});
