// plugins/guides/audio/AudioProviderRegistry.js
/** @type {Map<string, import('./AudioProvider')>} */
const providers = new Map();

/**
 * @param {string} name
 * @param {import('./AudioProvider')} instance
 */
function register(name, instance) {
  instance.name = name;
  providers.set(name, instance);
}

/**
 * @param {string} name
 */
function get(name) {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Audio provider not registered: ${name}`);
  }
  return provider;
}

/**
 * @param {string} name
 */
function has(name) {
  return providers.has(name);
}

/**
 * @returns {string[]}
 */
function listNames() {
  return Array.from(providers.keys());
}

/**
 * Default provider for v1 (noop stub).
 */
function resolveDefault() {
  return get('noop');
}

module.exports = {
  register,
  get,
  has,
  listNames,
  resolveDefault,
};
