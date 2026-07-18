const ContentSourceRegistry = require('./ContentSourceRegistry');
const WikipediaContentSource = require('./adapters/WikipediaContentSource');
const UnescoContentSource = require('./adapters/UnescoContentSource');

let registered = false;

function ensureContentSourcesRegistered() {
  if (registered) return;
  if (!ContentSourceRegistry.has('wikipedia')) {
    ContentSourceRegistry.register('wikipedia', () => new WikipediaContentSource());
  }
  if (!ContentSourceRegistry.has('unesco')) {
    ContentSourceRegistry.register('unesco', () => new UnescoContentSource());
  }
  registered = true;
}

/** @internal */
function _resetContentSourcesRegistrationForTests() {
  registered = false;
  ContentSourceRegistry.clear();
}

module.exports = {
  ensureContentSourcesRegistered,
  _resetContentSourcesRegistrationForTests,
};
