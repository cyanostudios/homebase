const { PulseProviderRouter } = require('../PulseProviderRouter');

describe('PulseProviderRouter', () => {
  let settingsModel;
  let router;

  beforeEach(() => {
    settingsModel = {
      getRoutingForScope: jest.fn(),
      getPreferredEnabledSmsProviderKey: jest.fn(),
      resolveRuntimeConfig: jest.fn(),
    };
    router = new PulseProviderRouter({ settingsModel });
  });

  test('prefers plugin override over global default', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'contacts',
        providerKey: 'twilio',
      })
      .mockResolvedValueOnce(null);
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'twilio',
      secretPrimary: 'ACxxx',
      secretSecondary: 'token',
      options: { fromNumber: '+15551234567' },
    });

    const result = await router.resolve({}, { pluginKey: 'contacts' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, 'contacts');
    expect(result).toEqual({
      providerKey: 'twilio',
      secretPrimary: 'ACxxx',
      secretSecondary: 'token',
      options: { fromNumber: '+15551234567' },
      source: 'plugin',
    });
  });

  test('uses global default when plugin override is missing', async () => {
    settingsModel.getRoutingForScope.mockResolvedValueOnce(null).mockResolvedValueOnce({
      scope: '*',
      providerKey: 'mock',
    });
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
    });

    const result = await router.resolve({}, { pluginKey: 'slots' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, '*');
    expect(result).toEqual({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
      source: 'global',
    });
  });

  test('falls back to legacy preferred SMS provider when routing is unset', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledSmsProviderKey.mockResolvedValue('twilio');
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'twilio',
      secretPrimary: 'ACyyy',
      secretSecondary: 'tok',
      options: { fromNumber: '+1' },
    });

    const result = await router.resolve({}, { pluginKey: 'pulses' });

    expect(result?.source).toBe('legacy');
    expect(result?.providerKey).toBe('twilio');
  });

  test('returns null when no routing or credentials exist', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledSmsProviderKey.mockResolvedValue(null);

    const result = await router.resolve({}, { pluginKey: 'pulses' });

    expect(result).toBeNull();
  });

  test('checkReadiness returns provider_not_sms_capable for verify-only routing', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: '*',
      providerKey: 'stytch',
    });

    const readiness = await router.checkReadiness({}, { pluginKey: 'pulses' });

    expect(readiness).toEqual({
      ready: false,
      providerKey: 'stytch',
      failure: { code: 'provider_not_sms_capable' },
    });
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });

  test('resolve returns null when routed provider is verify-only', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: '*',
      providerKey: 'twilio-verify',
    });

    const result = await router.resolve({}, { pluginKey: 'pulses' });
    expect(result).toBeNull();
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });
});
