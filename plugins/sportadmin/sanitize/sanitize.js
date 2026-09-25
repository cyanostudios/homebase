// plugins/sportadmin/sanitize/sanitize.js
// Allowlist sanitizer for imported SportAdmin HTML/text/URLs (no credentials).

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

/**
 * @param {string|null|undefined} html
 * @returns {string}
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }
  let out = String(html)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  out = out.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (match, tag, attrs = '') => {
    const name = String(tag).toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(name)) {
      return '';
    }
    if (closing) {
      return `</${name}>`;
    }
    if (name === 'br') {
      return '<br>';
    }
    if (name === 'a') {
      const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const rawHref = hrefMatch ? hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '' : '';
      const safe = sanitizeUrl(rawHref);
      if (!safe) {
        return '';
      }
      return `<a href="${escapeAttr(safe)}" rel="noopener noreferrer" target="_blank">`;
    }
    return `<${name}>`;
  });

  return out.trim();
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function sanitizeText(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Like sanitizeText but keeps paragraph breaks (newlines).
 * @param {string|null|undefined} value
 * @returns {string}
 */
function sanitizeMultilineText(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('javascript:')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

module.exports = { sanitizeHtml, sanitizeText, sanitizeMultilineText, sanitizeUrl };
