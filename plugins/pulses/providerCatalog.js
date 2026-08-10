/**
 * Data-driven metadata for Pulse SMS / verify providers.
 * Frontend forms and save whitelist are driven from this catalog.
 */

function freezeFields(fields) {
  return Object.freeze((fields || []).map((field) => Object.freeze({ ...field })));
}

/**
 * @typedef {object} PulseCatalogField
 * @property {string} key - Logical field key (accountSid, authToken, fromNumber, …)
 * @property {'secret_primary'|'secret_secondary'|'option'} storage
 * @property {string} labelKey - i18n key under pulses.providers.*
 * @property {boolean} [secret]
 * @property {boolean} [required]
 */

const PROVIDER_CATALOG = Object.freeze({
  twilio: Object.freeze({
    key: 'twilio',
    smsNotificationCapable: true,
    verifyCapable: false,
    fields: freezeFields([
      {
        key: 'accountSid',
        storage: 'secret_primary',
        labelKey: 'pulses.accountSid',
        secret: true,
        required: true,
      },
      {
        key: 'authToken',
        storage: 'secret_secondary',
        labelKey: 'pulses.authToken',
        secret: true,
        required: true,
      },
      {
        key: 'fromNumber',
        storage: 'option',
        labelKey: 'pulses.fromNumber',
        secret: false,
        required: true,
      },
    ]),
  }),
  mock: Object.freeze({
    key: 'mock',
    smsNotificationCapable: true,
    verifyCapable: false,
    fields: freezeFields([]),
  }),
  'twilio-verify': Object.freeze({
    key: 'twilio-verify',
    smsNotificationCapable: false,
    verifyCapable: true,
    fields: freezeFields([
      {
        key: 'accountSid',
        storage: 'secret_primary',
        labelKey: 'pulses.accountSid',
        secret: true,
        required: true,
      },
      {
        key: 'authToken',
        storage: 'secret_secondary',
        labelKey: 'pulses.authToken',
        secret: true,
        required: true,
      },
      {
        key: 'serviceSid',
        storage: 'option',
        labelKey: 'pulses.providers.twilio-verify.serviceSid',
        secret: false,
        required: true,
      },
    ]),
  }),
  stytch: Object.freeze({
    key: 'stytch',
    smsNotificationCapable: false,
    verifyCapable: true,
    fields: freezeFields([
      {
        key: 'projectId',
        storage: 'secret_primary',
        labelKey: 'pulses.providers.stytch.projectId',
        secret: true,
        required: true,
      },
      {
        key: 'secret',
        storage: 'secret_secondary',
        labelKey: 'pulses.providers.stytch.secret',
        secret: true,
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

function isSmsNotificationCapable(providerKey) {
  return getProviderCatalogEntry(providerKey)?.smsNotificationCapable === true;
}

function isVerifyCapable(providerKey) {
  return getProviderCatalogEntry(providerKey)?.verifyCapable === true;
}

function listCatalogForApi() {
  return Object.values(PROVIDER_CATALOG).map((entry) => ({
    providerKey: entry.key,
    smsNotificationCapable: entry.smsNotificationCapable === true,
    verifyCapable: entry.verifyCapable === true,
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
  isSmsNotificationCapable,
  isVerifyCapable,
  listCatalogForApi,
};
