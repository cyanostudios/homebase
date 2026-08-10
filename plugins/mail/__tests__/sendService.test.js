jest.mock('../model', () => ({
  logSent: jest.fn(),
}));
jest.mock('../EmailAdapterRegistry', () => ({
  has: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../MailProviderRouter', () => ({
  MailProviderRouter: jest.fn().mockImplementation(() => ({
    resolve: jest.fn(),
  })),
}));

const model = require('../model');
const EmailAdapterRegistry = require('../EmailAdapterRegistry');
const { MailProviderRouter } = require('../MailProviderRouter');

describe('mail sendService', () => {
  let resolveMock;
  let sendService;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveMock = jest.fn();
    MailProviderRouter.mockImplementation(() => ({
      resolve: resolveMock,
    }));
    jest.isolateModules(() => {
      sendService = require('../sendService');
    });
  });

  test('getEmailServiceForUser uses pluginKey and returns adapter', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'resend',
      secretPrimary: 're_x',
      secretSecondary: null,
      options: { fromAddress: 'a@b.com' },
      source: 'plugin',
    });
    EmailAdapterRegistry.has.mockReturnValue(true);
    const adapter = { send: jest.fn() };
    EmailAdapterRegistry.create.mockReturnValue(adapter);

    const result = await sendService.getEmailServiceForUser({}, { pluginKey: 'contacts' });

    expect(resolveMock).toHaveBeenCalledWith({}, { pluginKey: 'contacts' });
    expect(result).toBe(adapter);
    expect(EmailAdapterRegistry.create).toHaveBeenCalledWith('resend', {
      secretPrimary: 're_x',
      secretSecondary: null,
      options: { fromAddress: 'a@b.com' },
    });
  });

  test('getEmailServiceForUser defaults pluginKey to mail', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'smtp',
      secretPrimary: null,
      secretSecondary: 'pass',
      options: { host: 'smtp.example.com', fromAddress: 'x@y.com', port: '587' },
      source: 'global',
    });
    EmailAdapterRegistry.has.mockReturnValue(true);
    EmailAdapterRegistry.create.mockReturnValue({ send: jest.fn() });

    await sendService.getEmailServiceForUser({});

    expect(resolveMock).toHaveBeenCalledWith({}, { pluginKey: 'mail' });
  });

  test('getEmailServiceForUser fail-closes when resolve returns null', async () => {
    resolveMock.mockResolvedValue(null);

    await expect(sendService.getEmailServiceForUser({})).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('No email provider is configured'),
    });
  });

  test('getEmailServiceForUser rejects incomplete resend credentials', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'resend',
      secretPrimary: 're_x',
      secretSecondary: null,
      options: {},
      source: 'global',
    });
    EmailAdapterRegistry.has.mockReturnValue(true);

    await expect(sendService.getEmailServiceForUser({})).rejects.toMatchObject({
      message: expect.stringContaining('incomplete'),
    });
  });

  test('getEmailServiceForUser rejects incomplete smtp credentials', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'smtp',
      secretPrimary: null,
      secretSecondary: 'pass',
      options: { fromAddress: 'a@b.com' },
      source: 'global',
    });
    EmailAdapterRegistry.has.mockReturnValue(true);

    await expect(sendService.getEmailServiceForUser({})).rejects.toMatchObject({
      message: expect.stringContaining('incomplete'),
    });
  });

  test('sendWithUserSettings logs after successful send', async () => {
    resolveMock.mockResolvedValue({
      providerKey: 'resend',
      secretPrimary: 're_x',
      secretSecondary: null,
      options: { fromAddress: 'a@b.com' },
      source: 'global',
    });
    EmailAdapterRegistry.has.mockReturnValue(true);
    const send = jest.fn().mockResolvedValue({});
    EmailAdapterRegistry.create.mockReturnValue({ send });
    model.logSent.mockResolvedValue({ id: '1' });

    const entry = await sendService.sendWithUserSettings(
      {},
      { to: 'a@b.com', subject: 'Hi', text: 'body' },
      { pluginSource: 'contacts' },
    );

    expect(send).toHaveBeenCalled();
    expect(model.logSent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ pluginSource: 'contacts', subject: 'Hi' }),
    );
    expect(entry).toEqual({ id: '1' });
  });
});
