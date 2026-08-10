jest.mock('../model', () => ({
  logSent: jest.fn(),
}));
jest.mock('../SmsAdapterRegistry', () => ({
  has: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../PulseProviderRouter', () => ({
  PulseProviderRouter: jest.fn().mockImplementation(() => ({
    resolve: jest.fn(),
  })),
}));

const model = require('../model');
const SmsAdapterRegistry = require('../SmsAdapterRegistry');
const { PulseProviderRouter } = require('../PulseProviderRouter');

describe('sendService', () => {
  let resolveMock;
  let sendService;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveMock = jest.fn();
    PulseProviderRouter.mockImplementation(() => ({
      resolve: resolveMock,
    }));
    // Re-require so module picks up mocked router instance
    jest.isolateModules(() => {
      sendService = require('../sendService');
    });
  });

  test('getSmsAdapterForUser uses pluginKey and returns adapter', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'twilio',
      secretPrimary: 'AC',
      secretSecondary: 'tok',
      options: { fromNumber: '+1555' },
      source: 'plugin',
    });
    SmsAdapterRegistry.has.mockReturnValue(true);
    const adapter = { send: jest.fn() };
    SmsAdapterRegistry.create.mockReturnValue(adapter);

    const result = await sendService.getSmsAdapterForUser({}, { pluginKey: 'contacts' });

    expect(resolveMock).toHaveBeenCalledWith({}, { pluginKey: 'contacts' });
    expect(result.provider).toBe('twilio');
    expect(result.adapter).toBe(adapter);
    expect(SmsAdapterRegistry.create).toHaveBeenCalledWith('twilio', {
      secretPrimary: 'AC',
      secretSecondary: 'tok',
      options: { fromNumber: '+1555' },
    });
  });

  test('getSmsAdapterForUser defaults pluginKey to pulses', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
      source: 'global',
    });
    SmsAdapterRegistry.has.mockReturnValue(true);
    SmsAdapterRegistry.create.mockReturnValue({ send: jest.fn() });

    await sendService.getSmsAdapterForUser({});

    expect(resolveMock).toHaveBeenCalledWith({}, { pluginKey: 'pulses' });
  });

  test('getSmsAdapterForUser fail-closes when resolve returns null', async () => {
    resolveMock.mockResolvedValue(null);

    await expect(sendService.getSmsAdapterForUser({})).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('No SMS provider is configured'),
    });
  });

  test('getSmsAdapterForUser rejects incomplete twilio credentials', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'twilio',
      secretPrimary: 'AC',
      secretSecondary: 'tok',
      options: {},
      source: 'global',
    });
    SmsAdapterRegistry.has.mockReturnValue(true);

    await expect(sendService.getSmsAdapterForUser({})).rejects.toMatchObject({
      message: expect.stringContaining('incomplete'),
    });
  });

  test('sendSmsWithUserSettings passes pluginSource as pluginKey and logs', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'mock',
      secretPrimary: null,
      secretSecondary: null,
      options: {},
      source: 'global',
    });
    SmsAdapterRegistry.has.mockReturnValue(true);
    const send = jest.fn().mockResolvedValue({ status: 'sent' });
    SmsAdapterRegistry.create.mockReturnValue({ send });
    model.logSent.mockResolvedValue({ id: '1', status: 'sent' });

    const entry = await sendService.sendSmsWithUserSettings(
      {},
      { to: '+4670', body: 'hi' },
      { pluginSource: 'slots', referenceId: 'ref-1' },
    );

    expect(resolveMock).toHaveBeenCalledWith({}, { pluginKey: 'slots' });
    expect(send).toHaveBeenCalledWith({ to: '+4670', body: 'hi' });
    expect(model.logSent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        recipient: '+4670',
        provider: 'mock',
        pluginSource: 'slots',
        referenceId: 'ref-1',
      }),
    );
    expect(entry.id).toBe('1');
  });
});
