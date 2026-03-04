/**
 * Strip HTML, CSS, Slate layout and other non-API content from PostNord Postman JSON.
 * Keeps only API-relevant text in description fields.
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../docs/API-DOCS/POSTNORD-API-JSON.json');
const OUTPUT = INPUT;

function stripHtml(str) {
  if (typeof str !== 'string') return str;
  let s = str
    // Remove entire <style>...</style> blocks including content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove <script> blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove HTML/head/body wrappers (opening and closing)
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    // Convert block elements to newlines before stripping
    .replace(/<\/?(p|div|br|tr|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<\/?ul[^>]*>/gi, '\n')
    .replace(/<\/?ol[^>]*>/gi, '\n')
    // Strip remaining tags but keep content
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse multiple newlines/whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return s;
}

function processValue(obj) {
  if (typeof obj === 'string') {
    if (/<html|<\/?style|<head|<body|class="|\.css|slate/i.test(obj)) {
      return stripHtml(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(processValue);
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = processValue(v);
    }
    return out;
  }
  return obj;
}

const json = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const cleaned = processValue(json);
fs.writeFileSync(OUTPUT, JSON.stringify(cleaned, null, 0), 'utf8');
console.log('Cleaned POSTNORD-API-JSON.json');
