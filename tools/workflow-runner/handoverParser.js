'use strict';

const crypto = require('crypto');
const { HANDOVER_STATUS, WORKFLOW_STATES, HANDOVER_VERSION, ROLES } = require('./constants');

const REQUIRED_KEYS = [
  'Status',
  'Workflow State',
  'Current Role',
  'Reason',
  'Blocking Decisions',
  'Deliverables',
  'Risks',
  'Scope Changes',
  'Requires User Input',
  'User Decision',
  'Handover Version',
];

const CANONICAL_ROLES = new Set(Object.values(ROLES));

/**
 * Extract the first ```handover ... ``` fenced block from raw text.
 * @param {string} raw
 * @returns {{ body: string } | { error: string }}
 */
function extractHandoverFence(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { error: 'Empty handover input' };
  }
  const match = raw.match(/```handover\s*\n([\s\S]*?)```/);
  if (!match) {
    // Allow raw body without fence when already extracted
    if (/^Status:\s*/m.test(raw.trim())) {
      return { body: raw.trim() };
    }
    return { error: 'No ```handover fenced block found' };
  }
  return { body: match[1].trim() };
}

/**
 * Parse YAML-style handover body into a field map.
 * Lists under Deliverables / Risks / etc. are collected as string arrays.
 * @param {string} body
 * @returns {{ fields: Record<string, string | string[]>, fingerprint: string } | { error: string }}
 */
function parseHandoverBody(body) {
  const lines = body.split(/\r?\n/);
  const fields = {};
  let currentListKey = null;

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentListKey) {
      if (!Array.isArray(fields[currentListKey])) {
        fields[currentListKey] = [];
      }
      fields[currentListKey].push(listItem[1].trim());
      continue;
    }

    const kv = line.match(/^([A-Za-z][A-Za-z0-9 /]*):\s*(.*)$/);
    if (!kv) {
      if (line.trim() === '') continue;
      return { error: `Unparseable line: ${line}` };
    }
    const key = kv[1].trim();
    const value = kv[2].trim();
    currentListKey = null;

    if (
      value === '' &&
      ['Deliverables', 'Risks', 'Scope Changes', 'Blocking Decisions'].includes(key)
    ) {
      fields[key] = [];
      currentListKey = key;
      continue;
    }

    fields[key] = value;
    if (
      ['Deliverables', 'Risks', 'Scope Changes', 'Blocking Decisions'].includes(key) &&
      value === ''
    ) {
      currentListKey = key;
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (fields[key] === undefined) {
      return { error: `Missing required field: ${key}` };
    }
  }

  if (fields['Handover Version'] !== HANDOVER_VERSION) {
    return {
      error: `Unsupported Handover Version: ${fields['Handover Version']} (expected ${HANDOVER_VERSION})`,
    };
  }

  if (!HANDOVER_STATUS.includes(fields.Status)) {
    return { error: `Invalid Status: ${fields.Status}` };
  }

  if (!WORKFLOW_STATES.includes(fields['Workflow State'])) {
    return { error: `Invalid Workflow State: ${fields['Workflow State']}` };
  }

  if (!CANONICAL_ROLES.has(fields['Current Role'])) {
    return { error: `Invalid Current Role: ${fields['Current Role']}` };
  }

  if (!['Yes', 'No'].includes(fields['Requires User Input'])) {
    return { error: `Invalid Requires User Input: ${fields['Requires User Input']}` };
  }

  normalizeListField(fields, 'Blocking Decisions');
  normalizeListField(fields, 'Deliverables');
  normalizeListField(fields, 'Risks');
  normalizeListField(fields, 'Scope Changes');

  const fingerprint = crypto.createHash('sha256').update(body.trim()).digest('hex');

  return { fields, fingerprint, body: body.trim() };
}

function normalizeListField(fields, key) {
  const v = fields[key];
  if (Array.isArray(v)) {
    if (v.length === 0) fields[key] = 'None';
    return;
  }
  if (typeof v === 'string' && (v === 'None' || v === 'N/A' || v.trim() === '')) {
    fields[key] = v.trim() === '' ? 'None' : v;
  }
}

/**
 * Parse raw handover input (fenced or body).
 * @param {string} raw
 * @returns {{ ok: true, fields: object, fingerprint: string, body: string } | { ok: false, error: string }}
 */
function parseHandover(raw) {
  const extracted = extractHandoverFence(raw);
  if (extracted.error) {
    return { ok: false, error: extracted.error };
  }
  const parsed = parseHandoverBody(extracted.body);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  return {
    ok: true,
    fields: parsed.fields,
    fingerprint: parsed.fingerprint,
    body: parsed.body,
  };
}

function isNoneLike(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  const s = String(value).trim();
  return s === '' || s === 'None' || s === 'N/A';
}

module.exports = {
  extractHandoverFence,
  parseHandoverBody,
  parseHandover,
  isNoneLike,
  REQUIRED_KEYS,
};
