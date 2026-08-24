const {
  coerceRequestTypeConfig,
  coerceRequestTypes,
  toPublicRequestType,
  findRequestTypeConfig,
} = require('../requestTypeConfig');

describe('requestTypeConfig', () => {
  it('coerces legacy strings and object configs', () => {
    expect(coerceRequestTypeConfig('  Kit  ')).toEqual({ key: 'Kit' });
    expect(coerceRequestTypeConfig('')).toBeNull();
    expect(
      coerceRequestTypeConfig({
        key: 'kit',
        plugin: 'garments',
        targetListId: '42',
        intakeSchema: [{ key: 'name', required: true }, { key: 'shirtSize' }],
      }),
    ).toEqual({
      key: 'kit',
      plugin: 'garments',
      targetListId: '42',
      intakeSchema: [{ key: 'name', required: true }, { key: 'shirtSize' }],
    });
  });

  it('dedupes keys and ignores unsupported plugins', () => {
    expect(
      coerceRequestTypes([
        'general',
        { key: 'general' },
        { key: 'other', plugin: 'unknown', targetListId: '1' },
        { key: 'kit', plugin: 'garments', targetListId: '9' },
      ]),
    ).toEqual([
      { key: 'general' },
      { key: 'other' },
      { key: 'kit', plugin: 'garments', targetListId: '9' },
    ]);
  });

  it('toPublicRequestType never includes targetListId', () => {
    const publicType = toPublicRequestType({
      key: 'kit',
      plugin: 'garments',
      targetListId: 'secret',
      intakeSchema: [{ key: 'name', required: true }],
    });
    expect(publicType).toEqual({
      key: 'kit',
      plugin: 'garments',
      intakeSchema: [{ key: 'name', required: true }],
    });
    expect(publicType).not.toHaveProperty('targetListId');
  });

  it('findRequestTypeConfig resolves after coerce', () => {
    const found = findRequestTypeConfig(
      ['a', { key: 'kit', plugin: 'garments', targetListId: '7' }],
      'kit',
    );
    expect(found).toMatchObject({ key: 'kit', plugin: 'garments', targetListId: '7' });
  });
});
