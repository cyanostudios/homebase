const { listCatalogForApi, isEmailCapable, SUPPORTED_PROVIDERS } = require('../providerCatalog');

describe('mail providerCatalog', () => {
  test('includes smtp and resend', () => {
    expect(SUPPORTED_PROVIDERS.has('smtp')).toBe(true);
    expect(SUPPORTED_PROVIDERS.has('resend')).toBe(true);
  });

  test('both providers are email capable', () => {
    expect(isEmailCapable('smtp')).toBe(true);
    expect(isEmailCapable('resend')).toBe(true);
  });

  test('listCatalogForApi exposes fields metadata', () => {
    const catalog = listCatalogForApi();
    const smtp = catalog.find((entry) => entry.providerKey === 'smtp');
    expect(smtp?.fields?.some((field) => field.key === 'host')).toBe(true);
    expect(smtp?.fields?.some((field) => field.key === 'fromAddress')).toBe(true);
    const resend = catalog.find((entry) => entry.providerKey === 'resend');
    expect(resend?.fields?.some((field) => field.key === 'apiKey')).toBe(true);
    expect(resend?.emailCapable).toBe(true);
  });
});
