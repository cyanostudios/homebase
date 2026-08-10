const {
  listCatalogForApi,
  isSmsNotificationCapable,
  isVerifyCapable,
  SUPPORTED_PROVIDERS,
} = require('../providerCatalog');

describe('pulse providerCatalog', () => {
  test('includes twilio, mock, twilio-verify, stytch', () => {
    expect(SUPPORTED_PROVIDERS.has('twilio')).toBe(true);
    expect(SUPPORTED_PROVIDERS.has('mock')).toBe(true);
    expect(SUPPORTED_PROVIDERS.has('twilio-verify')).toBe(true);
    expect(SUPPORTED_PROVIDERS.has('stytch')).toBe(true);
  });

  test('only twilio and mock are SMS notification capable', () => {
    expect(isSmsNotificationCapable('twilio')).toBe(true);
    expect(isSmsNotificationCapable('mock')).toBe(true);
    expect(isSmsNotificationCapable('twilio-verify')).toBe(false);
    expect(isSmsNotificationCapable('stytch')).toBe(false);
  });

  test('verifyCapable flags for twilio-verify and stytch', () => {
    expect(isVerifyCapable('twilio-verify')).toBe(true);
    expect(isVerifyCapable('stytch')).toBe(true);
    expect(isVerifyCapable('twilio')).toBe(false);
  });

  test('listCatalogForApi exposes fields metadata', () => {
    const catalog = listCatalogForApi();
    const twilio = catalog.find((entry) => entry.providerKey === 'twilio');
    expect(twilio?.fields?.some((field) => field.key === 'fromNumber')).toBe(true);
    const stytch = catalog.find((entry) => entry.providerKey === 'stytch');
    expect(stytch?.verifyCapable).toBe(true);
    expect(stytch?.smsNotificationCapable).toBe(false);
  });
});
