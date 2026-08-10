jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Context: { getTenantUserId: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Context, Database } = require('@homebase/core');
const { MailProviderSettingsModel, MASKED_SECRET } = require('../providerModel');

describe('MailProviderSettingsModel', () => {
  let model;
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new MailProviderSettingsModel();
    db = { query: jest.fn() };
    Context.getTenantUserId.mockReturnValue(7);
    Database.get.mockReturnValue(db);
  });

  test('getSettings masks secrets and filters unknown options', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'resend',
        enabled: true,
        secret_primary: 're_xxx',
        secret_secondary: null,
        options: { fromAddress: 'a@b.com', leakedSecret: 'should-not-appear' },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.getSettings({}, 'resend');

    expect(result).toEqual(
      expect.objectContaining({
        providerKey: 'resend',
        enabled: true,
        secretPrimary: MASKED_SECRET,
        hasSecretPrimary: true,
        options: { fromAddress: 'a@b.com' },
        configured: true,
        emailCapable: true,
      }),
    );
    expect(result.options.leakedSecret).toBeUndefined();
  });

  test('saveSettings preserves masked secrets and ignores non-catalog options', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 1,
          secret_primary: 're_stored',
          secret_secondary: null,
          options: JSON.stringify({ fromAddress: 'old@x.com' }),
          enabled: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          provider_key: 'resend',
          enabled: true,
          secret_primary: 're_stored',
          secret_secondary: null,
          options: { fromAddress: 'new@x.com' },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]);

    await model.saveSettings({}, 'resend', {
      enabled: true,
      secretPrimary: MASKED_SECRET,
      options: { fromAddress: 'new@x.com', apiKey: 'exfil-attempt' },
    });

    const saveParams = db.query.mock.calls[1][1];
    expect(saveParams[3]).toBe('re_stored');
    const savedOptions = JSON.parse(saveParams[5]);
    expect(savedOptions).toEqual({ fromAddress: 'new@x.com' });
    expect(savedOptions.apiKey).toBeUndefined();
  });

  test('deleteSettings clears routing for provider then deletes settings', async () => {
    db.query.mockResolvedValue([]);

    await model.deleteSettings({}, 'smtp');

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toMatch(/DELETE FROM mail_provider_routing/);
    expect(db.query.mock.calls[0][1]).toEqual([7, 'smtp']);
    expect(db.query.mock.calls[1][0]).toMatch(/DELETE FROM mail_provider_settings/);
  });

  test('saveRouting rejects when provider is not configured and enabled', async () => {
    db.query.mockResolvedValueOnce([]);

    await expect(model.saveRouting({}, '*', { providerKey: 'resend' })).rejects.toMatchObject({
      message: 'Selected provider is not configured and enabled',
      statusCode: 400,
    });
  });

  test('saveRouting accepts configured resend', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          provider_key: 'resend',
          enabled: true,
          secret_primary: 're_x',
          secret_secondary: null,
          options: { fromAddress: 'a@b.com' },
          created_at: null,
          updated_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          user_id: 7,
          scope: '*',
          provider_key: 'resend',
          created_at: null,
          updated_at: null,
        },
      ]);

    const result = await model.saveRouting({}, '*', { providerKey: 'resend' });
    expect(result).toEqual({ global: { providerKey: 'resend' } });
  });

  test('getResolvedProviderConfig returns null when disabled', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'smtp',
        enabled: false,
        secret_primary: null,
        secret_secondary: 'pass',
        options: { host: 'h', fromAddress: 'f@x.com' },
        created_at: null,
        updated_at: null,
      },
    ]);

    const resolved = await model.getResolvedProviderConfig({}, 'smtp');
    expect(resolved).toBeNull();
  });
});
