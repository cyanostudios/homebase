const {
  validateExtraData,
  mapToPersonPayload,
  filterIntakeSchema,
  ALLOWLIST_KEYS,
} = require('../pluginTargets/garments');
const { getAdapter, listPluginIds } = require('../pluginTargets/registry');
const { AppError } = require('../../../server/core/errors/AppError');

describe('garments pluginTarget adapter', () => {
  const schema = [{ key: 'name', required: true }, { key: 'shirtSize' }, { key: 'jerseyNumber' }];

  it('validates allowlisted flat string fields', () => {
    expect(
      validateExtraData({ name: '  Ada  ', shirtSize: '152', jerseyNumber: '7' }, schema),
    ).toEqual({ name: 'Ada', shirtSize: '152', jerseyNumber: '7' });
  });

  it('rejects unknown keys and nested values', () => {
    expect(() => validateExtraData({ name: 'Ada', contactId: '1' }, schema)).toThrow(AppError);
    expect(() => validateExtraData({ name: 'Ada', shirtSize: { nested: true } }, schema)).toThrow(
      AppError,
    );
    expect(() => validateExtraData({ name: 1 }, schema)).toThrow(AppError);
  });

  it('enforces required schema fields and schema key membership', () => {
    expect(() => validateExtraData({ shirtSize: '152' }, schema)).toThrow(AppError);
    expect(() => validateExtraData({ name: 'Ada', comment: 'x' }, schema)).toThrow(AppError);
  });

  it('maps sanitized extra_data to person payload', () => {
    expect(
      mapToPersonPayload({
        name: 'Ada',
        shirtSize: '152',
        jerseyName: 'LOVELACE',
        initials: 'AL',
      }),
    ).toEqual({
      name: 'Ada',
      shirtSize: '152',
      shortsSize: null,
      socksSize: null,
      jerseyNumber: null,
      jerseyName: 'LOVELACE',
      initials: 'AL',
      comment: null,
    });
  });

  it('filters intake schema to allowlist', () => {
    expect(
      filterIntakeSchema([
        { key: 'name', required: true },
        { key: 'contactId' },
        { key: 'shirtSize' },
      ]),
    ).toEqual([{ key: 'name', required: true }, { key: 'shirtSize' }]);
  });

  it('is registered under garments', () => {
    expect(listPluginIds()).toEqual(['garments']);
    expect(getAdapter('garments').ALLOWLIST_KEYS).toEqual(ALLOWLIST_KEYS);
    expect(getAdapter('nope')).toBeNull();
  });
});
