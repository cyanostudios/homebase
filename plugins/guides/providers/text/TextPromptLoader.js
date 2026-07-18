// plugins/guides/providers/text/TextPromptLoader.js
const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

/** @type {{ promptSetVersion: string, entry: { system: string, user: string }, tokenBudgets: { maxCompletionTokens: number } } | null} */
let cachedManifest = null;

function loadManifest() {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(path.join(PROMPTS_DIR, 'manifest.json'), 'utf8');
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

function readPromptFile(relativePath) {
  return fs.readFileSync(path.join(PROMPTS_DIR, relativePath), 'utf8').trim();
}

/**
 * Replace {{key}} placeholders in a template string.
 * @param {string} template
 * @param {Record<string, string>} variables
 */
function interpolate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * @param {{
 *   canonicalNarrative?: string,
 *   language: string,
 *   placeContext?: object|null,
 *   sourcePackText?: string,
 * }} variables
 */
function getPrompts(variables) {
  const manifest = loadManifest();
  const entry = manifest.entry;
  if (!entry) {
    throw new Error('No prompt config for text derivation');
  }
  const place = variables.placeContext ?? null;
  const placeBlock = formatPlaceContextBlock(place);
  const vars = {
    canonicalNarrative: variables.canonicalNarrative ?? '',
    language: variables.language,
    sourcePackText: variables.sourcePackText
      ? String(variables.sourcePackText)
      : '(no research excerpts)',
    placeDisplayName: place?.displayName ? String(place.displayName) : '',
    placeFormattedAddress: place?.formattedAddress ? String(place.formattedAddress) : '',
    placeCountryCode: place?.countryCode ? String(place.countryCode) : '',
    placeAdminArea: place?.adminArea ? String(place.adminArea) : '',
    placeLocality: place?.locality ? String(place.locality) : '',
    placeCoordinates:
      place?.coordinates &&
      Number.isFinite(place.coordinates.lat) &&
      Number.isFinite(place.coordinates.lng)
        ? `${place.coordinates.lat}, ${place.coordinates.lng}`
        : '',
    placeTypes: Array.isArray(place?.placeTypes) ? place.placeTypes.join(', ') : '',
    placeContextBlock: placeBlock,
  };
  return {
    system: interpolate(readPromptFile(entry.system), vars),
    user: interpolate(readPromptFile(entry.user), vars),
    maxCompletionTokens: manifest.tokenBudgets?.maxCompletionTokens ?? 400,
    promptSetVersion: manifest.promptSetVersion,
    promptVersion: 'v1',
  };
}

/**
 * Build a human-readable place context block for prompt interpolation.
 * Domains pass structured placeContext; string form is derived only here (PL4).
 * @param {object|null|undefined} place
 */
function formatPlaceContextBlock(place) {
  if (!place || typeof place !== 'object') {
    return 'Place context: (not provided)';
  }
  const lines = ['Place context:'];
  if (place.displayName) lines.push(`- Name: ${place.displayName}`);
  if (place.formattedAddress) lines.push(`- Address: ${place.formattedAddress}`);
  if (place.locality) lines.push(`- Locality: ${place.locality}`);
  if (place.adminArea) lines.push(`- Region: ${place.adminArea}`);
  if (place.countryCode) lines.push(`- Country: ${place.countryCode}`);
  if (
    place.coordinates &&
    Number.isFinite(place.coordinates.lat) &&
    Number.isFinite(place.coordinates.lng)
  ) {
    lines.push(`- Coordinates: ${place.coordinates.lat}, ${place.coordinates.lng}`);
  }
  if (Array.isArray(place.placeTypes) && place.placeTypes.length) {
    lines.push(`- Types: ${place.placeTypes.join(', ')}`);
  }
  return lines.length > 1 ? lines.join('\n') : 'Place context: (not provided)';
}

function getPromptSetVersion() {
  return loadManifest().promptSetVersion;
}

/** Reset cached manifest — for tests only. */
function _resetCache() {
  cachedManifest = null;
}

module.exports = {
  getPrompts,
  getPromptSetVersion,
  _resetCache,
  PROMPTS_DIR,
};
