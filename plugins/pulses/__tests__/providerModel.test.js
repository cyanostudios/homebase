jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Context: { getTenantUserId: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Context, Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const { PulseProviderSettingsModel, MASKED_SECRET } = require('../providerModel');

describe('PulseProviderSettingsModel', () => {
  let model;
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new PulseProviderSettingsModel();
    db = { query: jest.fn() };
    Context.getTenantUserId.mockReturnValue(7);
    Database.get.mockReturnValue(db);
  });

  test('getSettings masks secrets and filters unknown options', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'twilio',
        enabled: true,
        secret_primary: 'ACxxx',
        secret_secondary: 'tok',
        options: { fromNumber: '+1555', leakedSecret: 'should-not-appear' },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.getSettings({}, 'twilio');

    expect(result).toEqual(
      expect.objectContaining({
        providerKey: 'twilio',
        enabled: true,
        secretPrimary: MASKED_SECRET,
        secretSecondary: MASKED_SECRET,
        hasSecretPrimary: true,
        hasSecretSecondary: true,
        options: { fromNumber: '+1555' },
        configured: true,
        smsNotificationCapable: true,
      }),
    );
    expect(result.options.leakedSecret).toBeUndefined();
  });

  test('saveSettings preserves masked secrets and ignores non-catalog options', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 1,
          secret_primary: 'ACstored',
          secret_secondary: 'tok-stored',
          options: JSON.stringify({ fromNumber: '+1000' }),
          enabled: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          provider_key: 'twilio',
          enabled: true,
          secret_primary: 'ACstored',
          secret_secondary: 'tok-stored',
          options: { fromNumber: '+1999' },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]);

    await model.saveSettings({}, 'twilio', {
      enabled: true,
      secretPrimary: MASKED_SECRET,
      secretSecondary: MASKED_SECRET,
      options: { fromNumber: '+1999', authToken: 'exfil-attempt' },
    });

    const saveParams = db.query.mock.calls[1][1];
    expect(saveParams[3]).toBe('ACstored');
    expect(saveParams[4]).toBe('tok-stored');
    const savedOptions = JSON.parse(saveParams[5]);
    expect(savedOptions).toEqual({ fromNumber: '+1999' });
    expect(savedOptions.authToken).toBeUndefined();
  });

  test('saveRouting rejects verify-only providers', async () => {
    db.query.mockResolvedValue([]);
    // getResolvedProviderConfig path via getSettings for stytch enabled+configured
    // First call inside _assertRoutingProviderAvailable → getSettings
    db.query.mockResolvedValueOnce([
      {
        id: 2,
        user_id: 7,
        provider_key: 'stytch',
        enabled: true,
        secret_primary: 'proj',
        secret_secondary: 'sec',
        options: {},
        created_at: null,
        updated_at: null,
      },
    ]);

    await expect(model.saveRouting({}, '*', { providerKey: 'stytch' })).rejects.toMatchObject({
      message: 'Selected provider cannot send SMS notifications',
      code: 'provider_not_sms_capable',
    });
  });

  test('saveRouting accepts configured twilio', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          provider_key: 'twilio',
          enabled: true,
          secret_primary: 'AC',
          secret_secondary: 'tok',
          options: { fromNumber: '+1' },
          created_at: null,
          updated_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          user_id: 7,
          scope: '*',
          provider_key: 'twilio',
          created_at: null,
          updated_at: null,
        },
      ]);

    const result = await model.saveRouting({}, '*', { providerKey: 'twilio' });
    expect(result).toEqual({ global: { providerKey: 'twilio' } });
  });

  test('deleteSettings clears routing rows for the provider', async () => {
    db.query.mockResolvedValue([]);

    const result = await model.deleteSettings({}, 'twilio');

    expect(result).toEqual({ providerKey: 'twilio', deleted: true });
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toMatch(/DELETE FROM pulse_provider_routing/);
    expect(db.query.mock.calls[0][1]).toEqual([7, 'twilio']);
    expect(db.query.mock.calls[1][0]).toMatch(/DELETE FROM pulse_provider_settings/);
    expect(db.query.mock.calls[1][1]).toEqual([7, 'twilio']);
  });

  test('getResolvedProviderConfig returns null when disabled', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'mock',
        enabled: false,
        secret_primary: null,
        secret_secondary: null,
        options: {},
        created_at: null,
        updated_at: null,
      },
    ]);

    const resolved = await model.getResolvedProviderConfig({}, 'mock');
    expect(resolved).toBeNull();
  });
});
