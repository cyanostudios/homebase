// plugins/guides/providers/text/TextPromptLoader.js
const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

/** @type {{ promptSetVersion: string, variants: Record<string, { system: string, user: string }>, tokenBudgets: Record<string, { maxCompletionTokens: number }> } | null} */
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
 * @param {'quick'|'normal'|'deep'} variantType
 * @param {{ canonicalNarrative: string, language: string, variantType: string }} variables
 */
function getPrompts(variantType, variables) {
  const manifest = loadManifest();
  const entry = manifest.variants[variantType];
  if (!entry) {
    throw new Error(`No prompt config for variant type: ${variantType}`);
  }
  const vars = {
    canonicalNarrative: variables.canonicalNarrative,
    language: variables.language,
    variantType: variables.variantType,
  };
  return {
    system: interpolate(readPromptFile(entry.system), vars),
    user: interpolate(readPromptFile(entry.user), vars),
    maxCompletionTokens: manifest.tokenBudgets[variantType]?.maxCompletionTokens ?? 400,
    promptSetVersion: manifest.promptSetVersion,
    promptVersion: 'v1',
  };
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
