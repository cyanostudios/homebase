// plugins/guides/providers/translation/TranslationPromptLoader.js
const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

/** @type {{ promptSetVersion: string, maxCompletionTokens: number } | null} */
let cachedManifest = null;

function loadManifest() {
  if (cachedManifest) return cachedManifest;
  cachedManifest = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'manifest.json'), 'utf8'));
  return cachedManifest;
}

function interpolate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * @param {{ presentationText: string, sourceLanguage: string, targetLanguage: string }} variables
 */
function getPrompts(variables) {
  const manifest = loadManifest();
  const system = fs.readFileSync(path.join(PROMPTS_DIR, 'v1.system.md'), 'utf8').trim();
  const userTpl = fs.readFileSync(path.join(PROMPTS_DIR, 'v1.user.md'), 'utf8').trim();
  const vars = {
    presentationText: variables.presentationText ?? '',
    sourceLanguage: variables.sourceLanguage ?? '',
    targetLanguage: variables.targetLanguage ?? '',
  };
  return {
    system: interpolate(system, vars),
    user: interpolate(userTpl, vars),
    maxCompletionTokens: manifest.maxCompletionTokens ?? 2000,
    promptSetVersion: manifest.promptSetVersion,
    promptVersion: 'v1',
  };
}

function getPromptSetVersion() {
  return loadManifest().promptSetVersion;
}

function _resetCache() {
  cachedManifest = null;
}

module.exports = { getPrompts, getPromptSetVersion, _resetCache, PROMPTS_DIR };
