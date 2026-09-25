// plugins/sportadmin/normalizer/normalize.js
const crypto = require('crypto');
const {
  sanitizeHtml,
  sanitizeText,
  sanitizeMultilineText,
  sanitizeUrl,
} = require('../sanitize/sanitize');

function resourceId(type, sourceId) {
  return `sportadmin:${type}:${sourceId}`;
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function looksLikeHtml(value) {
  return typeof value === 'string' && value.trimStart().startsWith('<');
}

function sanitizeDescriptionField(value) {
  if (!value) {
    return null;
  }
  if (looksLikeHtml(value)) {
    return sanitizeHtml(value) || null;
  }
  return sanitizeMultilineText(value) || null;
}

/**
 * Normalize a parsed resource into a DB row shape.
 * @param {object} parsed
 */
function normalizeResource(parsed) {
  const type = parsed.type;
  const sourceId = String(parsed.source_id);
  const base = {
    source: 'sportadmin',
    source_id: sourceId,
    type,
    source_url: sanitizeUrl(parsed.source_url) || parsed.source_url || null,
    source_image_url: sanitizeUrl(parsed.image_url || parsed.source_image_url) || null,
  };

  let payload = {};
  switch (type) {
    case 'organization':
      payload = {
        name: sanitizeText(parsed.name),
        description: sanitizeText(parsed.description || ''),
      };
      break;
    case 'team':
      payload = {
        name: sanitizeText(parsed.name),
        category: sanitizeText(parsed.category || '') || null,
        age_group: sanitizeText(parsed.age_group || '') || null,
        heading: sanitizeText(parsed.heading || '') || null,
        description: sanitizeDescriptionField(parsed.description),
        description_image_url: sanitizeUrl(parsed.description_image_url) || null,
        upcoming_matches: Array.isArray(parsed.upcoming_matches)
          ? parsed.upcoming_matches
              .slice(0, 20)
              .map((row) => ({
                title: sanitizeText(row.title || '') || '',
                when: sanitizeText(row.when || '') || null,
              }))
              .filter((row) => row.title)
          : [],
        played_matches: Array.isArray(parsed.played_matches)
          ? parsed.played_matches
              .slice(0, 20)
              .map((row) => ({
                title: sanitizeText(row.title || '') || '',
                when: sanitizeText(row.when || '') || null,
              }))
              .filter((row) => row.title)
          : [],
        news_items: Array.isArray(parsed.news_items)
          ? parsed.news_items
              .slice(0, 20)
              .map((row) => ({
                title: sanitizeText(row.title || '') || '',
                when: sanitizeText(row.when || '') || null,
                nid: sanitizeText(row.nid || '') || null,
                source_url: sanitizeUrl(row.source_url) || null,
                image_url: sanitizeUrl(row.image_url) || null,
                body: sanitizeMultilineText(row.body || '') || null,
              }))
              .filter((row) => row.title)
          : [],
        modules: parsed.modules
          ? {
              news: sanitizeUrl(parsed.modules.news) || null,
              calendar: sanitizeUrl(parsed.modules.calendar) || null,
              matches: sanitizeUrl(parsed.modules.matches) || null,
              roster: sanitizeUrl(parsed.modules.roster) || null,
              contact: sanitizeUrl(parsed.modules.contact) || null,
            }
          : null,
        players: Array.isArray(parsed.players)
          ? parsed.players
              .slice(0, 200)
              .map((row) => ({
                name: sanitizeText(row.name || '') || '',
                age: sanitizeText(row.age || '') || null,
                description: sanitizeText(row.description || '') || null,
                source_user_id: sanitizeText(row.source_user_id || '') || null,
              }))
              .filter((row) => row.name)
          : [],
        leaders: Array.isArray(parsed.leaders)
          ? parsed.leaders
              .slice(0, 50)
              .map((row) => ({
                name: sanitizeText(row.name || '') || '',
                age: sanitizeText(row.age || '') || null,
                description: sanitizeText(row.description || '') || null,
                source_user_id: sanitizeText(row.source_user_id || '') || null,
              }))
              .filter((row) => row.name)
          : [],
        contact: sanitizeDescriptionField(parsed.contact),
      };
      break;
    case 'page':
      payload = {
        title: sanitizeText(parsed.title || parsed.name || '') || '',
        kind: sanitizeText(parsed.kind || '') || null,
        heading: sanitizeText(parsed.heading || '') || null,
        description: sanitizeDescriptionField(parsed.description),
        description_image_url: sanitizeUrl(parsed.description_image_url) || null,
        sort_index: Number.isFinite(Number(parsed.sort_index)) ? Number(parsed.sort_index) : 0,
        news_items: Array.isArray(parsed.news_items)
          ? parsed.news_items
              .slice(0, 20)
              .map((row) => ({
                title: sanitizeText(row.title || '') || '',
                when: sanitizeText(row.when || '') || null,
                nid: sanitizeText(row.nid || '') || null,
                source_url: sanitizeUrl(row.source_url) || null,
                image_url: sanitizeUrl(row.image_url) || null,
                body: sanitizeMultilineText(row.body || '') || null,
              }))
              .filter((row) => row.title)
          : [],
      };
      break;
    case 'news':
      payload = {
        title: sanitizeText(parsed.title),
        excerpt: sanitizeText(parsed.excerpt || '') || null,
        content: parsed.content ? sanitizeHtml(parsed.content) : null,
        published_at: parsed.published_at || null,
      };
      break;
    case 'match':
      payload = {
        team: sanitizeText(parsed.team || '') || null,
        home_team: sanitizeText(parsed.home_team || '') || null,
        away_team: sanitizeText(parsed.away_team || '') || null,
        opponent: sanitizeText(parsed.opponent || '') || null,
        is_home: typeof parsed.is_home === 'boolean' ? parsed.is_home : null,
        date: parsed.date || null,
        time: parsed.time || null,
        venue: sanitizeText(parsed.venue || '') || null,
        pitch: sanitizeText(parsed.pitch || '') || null,
        category: sanitizeText(parsed.category || '') || null,
      };
      break;
    case 'event':
      payload = {
        title: sanitizeText(parsed.title),
        start: parsed.start || null,
        end: parsed.end || null,
        location: sanitizeText(parsed.location || '') || null,
        description: sanitizeText(parsed.description || '') || null,
      };
      break;
    case 'link':
      payload = {
        title: sanitizeText(parsed.title),
        url: sanitizeUrl(parsed.url) || parsed.url,
      };
      break;
    default:
      payload = { ...parsed };
  }

  const contentHash = hashPayload({
    ...payload,
    source_url: base.source_url,
    source_image_url: base.source_image_url,
  });

  return {
    id: resourceId(type, sourceId),
    ...base,
    payload,
    content_hash: contentHash,
  };
}

module.exports = { normalizeResource, resourceId, hashPayload };
