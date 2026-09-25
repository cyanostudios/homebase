// plugins/sportadmin/parser/CalendarParser.js
const { stripTags, absoluteUrl } = require('./htmlUtils');
const { sanitizeText } = require('../sanitize/sanitize');

function parseCalendarAjax(html, pageUrl) {
  /** @type {Array<{ source_id: string, title: string, start: string|null, end: string|null, location: string|null, description: string|null, source_url: string }>} */
  const events = [];
  const seen = new Set();
  const re = /href=['"]([^'"]*[?&]AID=(\d+)[^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const aid = m[2];
    if (seen.has(aid)) {
      continue;
    }
    seen.add(aid);
    const href = absoluteUrl(pageUrl, m[1]);
    const label = sanitizeText(stripTags(m[3])) || `Event ${aid}`;
    const around = stripTags(html.slice(Math.max(0, m.index - 120), m.index + 300));
    const dateMatch = around.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = around.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    events.push({
      source_id: aid,
      title: label,
      start: dateMatch
        ? `${dateMatch[1]}${timeMatch ? `T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00` : ''}`
        : null,
      end: null,
      location: null,
      description: null,
      source_url: href,
    });
  }
  return events;
}

module.exports = { parseCalendarAjax };
