// plugins/clubdesk/siteContentModel.js
const { Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const PUBLIC_CARD_KEYS = ['home', 'info'];
const ALL_CARD_KEYS = ['home', 'info', 'contacts', 'swish'];
const MAX_HTML_LENGTH = 100000;

class SiteContentModel {
  static PUBLIC_CARD_KEYS = PUBLIC_CARD_KEYS;
  static ALL_CARD_KEYS = ALL_CARD_KEYS;

  emptyCard(cardKey) {
    return {
      cardKey,
      content: '',
      meta: {},
      updatedAt: null,
    };
  }

  transformRow(row) {
    let meta = row.meta;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      meta = {};
    }
    return {
      cardKey: String(row.card_key),
      content: row.content ?? '',
      meta,
      updatedAt: row.updated_at ?? null,
    };
  }

  assertCardKey(cardKey) {
    const key = String(cardKey ?? '').trim();
    if (!ALL_CARD_KEYS.includes(key)) {
      throw new AppError('Invalid card key', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'cardKey', message: 'cardKey must be home, info, contacts, or swish' },
      ]);
    }
    return key;
  }

  normalizeContentForKey(cardKey, content) {
    if (cardKey === 'swish' || cardKey === 'contacts') {
      // Profiles / contact rows live in dedicated tables — cards are visibility shells.
      return '';
    }
    const html = content == null ? '' : String(content);
    if (html.length > MAX_HTML_LENGTH) {
      throw new AppError('content is too long', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'content', message: `content must not exceed ${MAX_HTML_LENGTH} characters` },
      ]);
    }
    return html;
  }

  /**
   * Visibility-only meta for shell cards (contacts / swish).
   * @returns {{ visible: boolean }}
   */
  normalizeVisibilityMeta(meta) {
    if (meta == null) {
      return { visible: true };
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) {
      throw new AppError('meta must be an object', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'meta', message: 'meta must be an object' },
      ]);
    }
    return { visible: meta.visible !== false };
  }

  /**
   * @param {string} cardKey
   * @param {unknown} meta
   */
  normalizeMetaForKey(cardKey, meta) {
    if (cardKey === 'swish' || cardKey === 'contacts') {
      return this.normalizeVisibilityMeta(meta);
    }

    if (meta == null) {
      return {};
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) {
      throw new AppError('meta must be an object', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'meta', message: 'meta must be an object' },
      ]);
    }

    if (cardKey === 'info' || cardKey === 'home') {
      const title = String(meta.title ?? '')
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 255);
      const out = {};
      if (title) {
        out.title = title;
      }
      // Info card: explicit public visibility (default true when omitted on read).
      if (cardKey === 'info') {
        out.visible = meta.visible !== false;
      }
      return out;
    }

    return {};
  }

  /**
   * @returns {Promise<Record<'home'|'info'|'contacts'|'swish', object>>}
   */
  async getAll(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rows = await db.query(
      `
        SELECT card_key, content, meta, updated_at
        FROM clubdesk_site_content
        WHERE user_id = $1
      `,
      [userId],
    );

    const byKey = Object.fromEntries(ALL_CARD_KEYS.map((k) => [k, this.emptyCard(k)]));
    for (const row of rows) {
      const card = this.transformRow(row);
      if (ALL_CARD_KEYS.includes(card.cardKey)) {
        byKey[card.cardKey] = card;
      }
    }
    return byKey;
  }

  /**
   * Upsert one card. Swish: empty content + Type C fields in meta (or `{}` when cleared).
   */
  async upsert(req, cardKey, { content, meta } = {}) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const key = this.assertCardKey(cardKey);
    const normalizedContent = this.normalizeContentForKey(key, content);
    const normalizedMeta = this.normalizeMetaForKey(key, meta);

    const rows = await db.query(
      `
        INSERT INTO clubdesk_site_content (user_id, card_key, content, meta, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (user_id, card_key)
        DO UPDATE SET
          content = EXCLUDED.content,
          meta = EXCLUDED.meta,
          updated_at = NOW()
        RETURNING card_key, content, meta, updated_at
      `,
      [userId, key, normalizedContent, JSON.stringify(normalizedMeta)],
    );

    return this.transformRow(rows[0]);
  }

  /**
   * Batch upsert home / info / contacts / swish cards.
   * @param {Array<{ cardKey: string, content?: string, meta?: object }>} cards
   */
  async upsertMany(req, cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new AppError('cards is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'cards', message: 'cards must be a non-empty array' },
      ]);
    }
    if (cards.length > ALL_CARD_KEYS.length) {
      throw new AppError('too many cards', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'cards', message: `at most ${ALL_CARD_KEYS.length} cards` },
      ]);
    }

    const seen = new Set();
    const normalized = [];
    for (const card of cards) {
      const key = this.assertCardKey(card?.cardKey);
      if (seen.has(key)) {
        throw new AppError('duplicate cardKey', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'cards', message: `duplicate cardKey: ${key}` },
        ]);
      }
      seen.add(key);
      normalized.push({
        cardKey: key,
        content: card.content,
        meta: card.meta,
      });
    }

    for (const card of normalized) {
      await this.upsert(req, card.cardKey, { content: card.content, meta: card.meta });
    }

    return this.getAll(req);
  }
}

module.exports = SiteContentModel;
