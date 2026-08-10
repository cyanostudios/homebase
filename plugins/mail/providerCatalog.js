/**
 * Data-driven metadata for Mail email providers.
 */

function freezeFields(fields) {
  return Object.freeze((fields || []).map((field) => Object.freeze({ ...field })));
}

const PROVIDER_CATALOG = Object.freeze({
  smtp: Object.freeze({
    key: 'smtp',
    emailCapable: true,
    fields: freezeFields([
      {
        key: 'host',
        storage: 'option',
        labelKey: 'mail.host',
        secret: false,
        required: true,
      },
      {
        key: 'port',
        storage: 'option',
        labelKey: 'mail.port',
        secret: false,
        required: true,
      },
      {
        key: 'secure',
        storage: 'option',
        labelKey: 'mail.secure',
        secret: false,
        required: false,
      },
      {
        key: 'authUser',
        storage: 'option',
        labelKey: 'mail.authUser',
        secret: false,
        required: false,
      },
      {
        key: 'authPass',
        storage: 'secret_secondary',
        labelKey: 'mail.authPass',
        secret: true,
        required: false,
      },
      {
        key: 'fromAddress',
        storage: 'option',
        labelKey: 'mail.fromAddress',
        secret: false,
        required: true,
      },
    ]),
  }),
  resend: Object.freeze({
    key: 'resend',
    emailCapable: true,
    fields: freezeFields([
      {
        key: 'apiKey',
        storage: 'secret_primary',
        labelKey: 'mail.resendApiKey',
        secret: true,
        required: true,
      },
      {
        key: 'fromAddress',
        storage: 'option',
        labelKey: 'mail.resendFromAddress',
        secret: false,
        required: true,
      },
    ]),
  }),
});

const SUPPORTED_PROVIDERS = new Set(Object.keys(PROVIDER_CATALOG));

function getProviderCatalogEntry(providerKey) {
  const key = String(providerKey ?? '')
    .trim()
    .toLowerCase();
  return PROVIDER_CATALOG[key] || null;
}

function isEmailCapable(providerKey) {
  return getProviderCatalogEntry(providerKey)?.emailCapable === true;
}

function listCatalogForApi() {
  return Object.values(PROVIDER_CATALOG).map((entry) => ({
    providerKey: entry.key,
    emailCapable: entry.emailCapable === true,
    fields: (entry.fields || []).map((field) => ({
      key: field.key,
      storage: field.storage,
      labelKey: field.labelKey,
      secret: field.secret === true,
      required: field.required === true,
    })),
  }));
}

module.exports = {
  PROVIDER_CATALOG,
  SUPPORTED_PROVIDERS,
  getProviderCatalogEntry,
  isEmailCapable,
  listCatalogForApi,
};
