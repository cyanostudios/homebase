import {
  coerceRequestTypeConfig,
  coerceRequestTypes,
  DEFAULT_GARMENTS_INTAKE_SCHEMA,
  groupGarmentListsForSelect,
} from '../requestTypeConfig';

describe('coerceRequestTypeConfig', () => {
  it('coerces legacy string to { key }', () => {
    expect(coerceRequestTypeConfig('  Kläder  ')).toEqual({ key: 'Kläder' });
  });

  it('returns null for blank string', () => {
    expect(coerceRequestTypeConfig('   ')).toBeNull();
  });

  it('keeps garments plugin link, targetListId, and intakeSchema', () => {
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

  it('ignores unsupported plugins', () => {
    expect(coerceRequestTypeConfig({ key: 'x', plugin: 'contacts' })).toEqual({ key: 'x' });
  });
});

describe('coerceRequestTypes', () => {
  it('dedupes keys and coerces mixed legacy/object entries', () => {
    expect(
      coerceRequestTypes([
        'general',
        { key: 'general', plugin: 'garments', targetListId: '1' },
        { key: 'Kläder', plugin: 'garments', targetListId: '9' },
        '',
        null,
      ]),
    ).toEqual([{ key: 'general' }, { key: 'Kläder', plugin: 'garments', targetListId: '9' }]);
  });
});

describe('DEFAULT_GARMENTS_INTAKE_SCHEMA', () => {
  it('requires name and includes size/jersey fields', () => {
    expect(DEFAULT_GARMENTS_INTAKE_SCHEMA[0]).toEqual({ key: 'name', required: true });
    expect(DEFAULT_GARMENTS_INTAKE_SCHEMA.map((f) => f.key)).toEqual([
      'name',
      'shirtSize',
      'shortsSize',
      'socksSize',
      'jerseyNumber',
      'jerseyName',
    ]);
  });
});

describe('groupGarmentListsForSelect', () => {
  const lists = [
    { id: '1', teamId: '10', name: 'A' },
    { id: '2', teamId: null, name: 'B' },
    { id: '3', teamId: '10', name: 'C' },
    { id: '4', teamId: '20', name: 'D' },
  ];

  it('puts preferred team lists first when preferredTeamId is set', () => {
    expect(groupGarmentListsForSelect(lists, '10')).toEqual({
      matching: [
        { id: '1', teamId: '10', name: 'A' },
        { id: '3', teamId: '10', name: 'C' },
      ],
      other: [
        { id: '2', teamId: null, name: 'B' },
        { id: '4', teamId: '20', name: 'D' },
      ],
    });
  });

  it('groups team-linked vs other when no preferred team', () => {
    expect(groupGarmentListsForSelect(lists)).toEqual({
      matching: [
        { id: '1', teamId: '10', name: 'A' },
        { id: '3', teamId: '10', name: 'C' },
        { id: '4', teamId: '20', name: 'D' },
      ],
      other: [{ id: '2', teamId: null, name: 'B' }],
    });
  });
});
