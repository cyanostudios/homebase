const { MailProviderRouter } = require('../MailProviderRouter');

describe('MailProviderRouter', () => {
  let settingsModel;
  let router;

  beforeEach(() => {
    settingsModel = {
      getRoutingForScope: jest.fn(),
      getPreferredEnabledEmailProviderKey: jest.fn(),
      resolveRuntimeConfig: jest.fn(),
    };
    router = new MailProviderRouter({ settingsModel });
  });

  test('prefers plugin override over global default', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'contacts',
        providerKey: 'resend',
      })
      .mockResolvedValueOnce(null);
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'resend',
      secretPrimary: 're_xxx',
      secretSecondary: null,
      options: { fromAddress: 'a@b.com' },
    });

    const result = await router.resolve({}, { pluginKey: 'contacts' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, 'contacts');
    expect(result).toEqual({
      providerKey: 'resend',
      secretPrimary: 're_xxx',
      secretSecondary: null,
      options: { fromAddress: 'a@b.com' },
      source: 'plugin',
    });
  });

  test('uses global default when plugin override is missing', async () => {
    settingsModel.getRoutingForScope.mockResolvedValueOnce(null).mockResolvedValueOnce({
      scope: '*',
      providerKey: 'smtp',
    });
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'smtp',
      secretPrimary: null,
      secretSecondary: 'pass',
      options: { host: 'smtp.example.com', fromAddress: 'x@y.com' },
    });

    const result = await router.resolve({}, { pluginKey: 'slots' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, '*');
    expect(result?.source).toBe('global');
    expect(result?.providerKey).toBe('smtp');
  });

  test('falls back to legacy preferred email provider when routing is unset', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledEmailProviderKey.mockResolvedValue('smtp');
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'smtp',
      secretPrimary: null,
      secretSecondary: 'p',
      options: { host: 'h', fromAddress: 'f@x.com' },
    });

    const result = await router.resolve({}, { pluginKey: 'mail' });

    expect(result?.source).toBe('legacy');
    expect(result?.providerKey).toBe('smtp');
  });

  test('returns null when no routing or credentials exist', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledEmailProviderKey.mockResolvedValue(null);

    const result = await router.resolve({}, { pluginKey: 'mail' });

    expect(result).toBeNull();
  });

  test('checkReadiness returns provider_not_email_capable for non-email routing', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: '*',
      providerKey: 'twilio',
    });

    const readiness = await router.checkReadiness({}, { pluginKey: 'mail' });

    expect(readiness).toEqual({
      ready: false,
      providerKey: 'twilio',
      failure: { code: 'provider_not_email_capable' },
    });
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });

  test('resolve returns null when routed provider is not email capable', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: '*',
      providerKey: 'twilio',
    });

    const result = await router.resolve({}, { pluginKey: 'mail' });
    expect(result).toBeNull();
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });
});
