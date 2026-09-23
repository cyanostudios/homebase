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

  test('prefers plugin override over global default when Pulse is enabled', async () => {
    settingsModel.getRoutingForScope.mockResolvedValueOnce({
      scope: 'contacts',
      providerKey: 'twilio',
      smsEnabled: true,
    });
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

  test('uses global default when Pulse is enabled without provider override', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'slots',
        providerKey: null,
        smsEnabled: true,
      })
      .mockResolvedValueOnce({
        scope: '*',
        providerKey: 'mock',
        smsEnabled: true,
      });
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
    });

    const result = await router.resolve({}, { pluginKey: 'slots' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, 'slots');
    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, '*');
    expect(result).toEqual({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
      source: 'global',
    });
  });

  test('returns null when Pulse is not enabled for the plugin', async () => {
    settingsModel.getRoutingForScope.mockResolvedValueOnce({
      scope: 'contacts',
      providerKey: null,
      smsEnabled: false,
    });

    const result = await router.resolve({}, { pluginKey: 'contacts' });

    expect(result).toBeNull();
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });

  test('falls back to legacy preferred SMS provider when enabled and routing unset', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'pulses',
        providerKey: null,
        smsEnabled: true,
      })
      .mockResolvedValueOnce(null);
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
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'pulses',
        providerKey: null,
        smsEnabled: true,
      })
      .mockResolvedValueOnce(null);
    settingsModel.getPreferredEnabledSmsProviderKey.mockResolvedValue(null);

    const result = await router.resolve({}, { pluginKey: 'pulses' });

    expect(result).toBeNull();
  });

  test('checkReadiness returns pulse_not_enabled_for_plugin when switch is off', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: 'pulses',
      providerKey: null,
      smsEnabled: false,
    });

    const readiness = await router.checkReadiness({}, { pluginKey: 'pulses' });

    expect(readiness).toEqual({
      ready: false,
      failure: { code: 'pulse_not_enabled_for_plugin' },
    });
  });

  test('checkReadiness returns provider_not_sms_capable for verify-only routing', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'pulses',
        providerKey: null,
        smsEnabled: true,
      })
      .mockResolvedValue({
        scope: '*',
        providerKey: 'stytch',
        smsEnabled: true,
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
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'pulses',
        providerKey: null,
        smsEnabled: true,
      })
      .mockResolvedValueOnce({
        scope: '*',
        providerKey: 'twilio-verify',
        smsEnabled: true,
      });

    const result = await router.resolve({}, { pluginKey: 'pulses' });
    expect(result).toBeNull();
    expect(settingsModel.resolveRuntimeConfig).not.toHaveBeenCalled();
  });
});
