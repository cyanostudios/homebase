const { AppError } = require('../../server/core/errors/AppError');

class PublicClubdeskModel {
  transformGuideListRow(row) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      featuredImageUrl: row.featured_image_url ?? null,
      category: row.category ?? null,
      stepCount:
        row.step_count !== null && row.step_count !== undefined ? Number(row.step_count) : 0,
      updatedAt: row.updated_at ?? null,
    };
  }

  transformPublicStep(row) {
    return {
      number: Number(row.sequence_order),
      title: row.title ?? '',
      description: row.description ?? null,
      image: row.image_url ?? null,
    };
  }

  transformGuideDetail(row, steps = []) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      featuredImageUrl: row.featured_image_url ?? null,
      category: row.category ?? null,
      updatedAt: row.updated_at ?? null,
      steps: steps.map((s) => this.transformPublicStep(s)),
    };
  }

  transformPriceListListRow(row) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      currency: row.currency ?? 'SEK',
      itemCount:
        row.item_count !== null && row.item_count !== undefined ? Number(row.item_count) : 0,
      updatedAt: row.updated_at ?? null,
    };
  }

  transformPriceListItem(row) {
    return {
      title: row.title ?? '',
      description: row.description ?? null,
      price: Number(row.price),
      category: row.category ?? null,
      sequenceOrder: Number(row.sequence_order),
    };
  }

  transformPriceListDetail(row, items = []) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      currency: row.currency ?? 'SEK',
      updatedAt: row.updated_at ?? null,
      items: items.map((i) => this.transformPriceListItem(i)),
    };
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async listGuideCategoryOrder(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT name
        FROM clubdesk_guide_categories
        WHERE user_id = $1
        ORDER BY sort_order ASC NULLS LAST, lower(name) ASC, id ASC
      `,
      [ownerUserId],
    );
    return result.rows.map((row) => String(row.name ?? '').trim()).filter(Boolean);
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async listPublishedGuides(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT
          g.id,
          g.title,
          g.slug,
          g.description,
          g.featured_image_url,
          g.category,
          g.sort_order,
          g.updated_at,
          COALESCE(s.cnt, 0)::int AS step_count
        FROM clubdesk_guides g
        LEFT JOIN (
          SELECT guide_id, COUNT(*)::int AS cnt
          FROM clubdesk_guide_steps
          GROUP BY guide_id
        ) s ON s.guide_id = g.id
        LEFT JOIN clubdesk_guide_categories c
          ON c.user_id = g.user_id
          AND lower(btrim(c.name)) = lower(btrim(g.category))
        WHERE g.user_id = $1
          AND g.publication_status = 'published'
        ORDER BY
          CASE
            WHEN g.category IS NULL OR btrim(g.category) = '' THEN 2
            WHEN c.id IS NULL THEN 1
            ELSE 0
          END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          g.sort_order ASC NULLS LAST,
          lower(g.title) ASC,
          g.id ASC
      `,
      [ownerUserId],
    );
    return result.rows.map((row) => this.transformGuideListRow(row));
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {string} slugOrId
   */
  async getPublishedGuideBySlugOrId(pool, ownerUserId, slugOrId) {
    const raw = String(slugOrId ?? '').trim();
    if (!raw) {
      throw new AppError('Invalid slug or id', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const asId = parseInt(raw, 10);
    const isNumericId = String(asId) === raw && asId > 0;

    let parentResult;
    if (isNumericId) {
      parentResult = await pool.query(
        `
          SELECT *
          FROM clubdesk_guides
          WHERE id = $2
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, asId],
      );
    } else {
      parentResult = await pool.query(
        `
          SELECT *
          FROM clubdesk_guides
          WHERE lower(slug) = lower($2)
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, raw],
      );
    }

    if (!parentResult.rows.length) {
      return null;
    }

    const parent = parentResult.rows[0];
    const stepsResult = await pool.query(
      `
        SELECT title, description, sequence_order, image_url
        FROM clubdesk_guide_steps
        WHERE guide_id = $1
        ORDER BY sequence_order ASC, id ASC
      `,
      [parent.id],
    );

    return this.transformGuideDetail(parent, stepsResult.rows);
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async listPublishedPriceLists(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.title,
          p.slug,
          p.description,
          p.currency,
          p.sort_order,
          p.updated_at,
          COALESCE(s.cnt, 0)::int AS item_count
        FROM clubdesk_price_lists p
        LEFT JOIN (
          SELECT price_list_id, COUNT(*)::int AS cnt
          FROM clubdesk_price_list_items
          GROUP BY price_list_id
        ) s ON s.price_list_id = p.id
        WHERE p.user_id = $1
          AND p.publication_status = 'published'
        ORDER BY
          p.sort_order ASC NULLS LAST,
          lower(p.title) ASC,
          p.id ASC
      `,
      [ownerUserId],
    );
    return result.rows.map((row) => this.transformPriceListListRow(row));
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {string} slugOrId
   */
  async getPublishedPriceListBySlugOrId(pool, ownerUserId, slugOrId) {
    const raw = String(slugOrId ?? '').trim();
    if (!raw) {
      throw new AppError('Invalid slug or id', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const asId = parseInt(raw, 10);
    const isNumericId = String(asId) === raw && asId > 0;

    let parentResult;
    if (isNumericId) {
      parentResult = await pool.query(
        `
          SELECT *
          FROM clubdesk_price_lists
          WHERE id = $2
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, asId],
      );
    } else {
      parentResult = await pool.query(
        `
          SELECT *
          FROM clubdesk_price_lists
          WHERE lower(slug) = lower($2)
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, raw],
      );
    }

    if (!parentResult.rows.length) {
      return null;
    }

    const parent = parentResult.rows[0];
    const itemsResult = await pool.query(
      `
        SELECT i.title, i.description, i.price, i.category, i.sequence_order
        FROM clubdesk_price_list_items i
        LEFT JOIN clubdesk_price_list_item_categories c
          ON c.price_list_id = i.price_list_id
          AND lower(btrim(c.name)) = lower(btrim(COALESCE(i.category, '')))
        WHERE i.price_list_id = $1
        ORDER BY
          CASE WHEN i.category IS NULL OR btrim(i.category) = '' THEN 1 ELSE 0 END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          lower(COALESCE(NULLIF(btrim(i.category), ''), '')) ASC,
          i.sequence_order ASC,
          i.id ASC
      `,
      [parent.id],
    );

    return this.transformPriceListDetail(parent, itemsResult.rows);
  }

  /**
   * Allowlist-sanitize TipTap-ish HTML for public kiosk rendering.
   * Strips scripts, event handlers, and dangerous URLs.
   */
  sanitizePublicHtml(html) {
    let out = String(html ?? '');
    if (!out) return '';

    // Remove dangerous elements entirely
    out = out.replace(/<\/?(script|style|iframe|object|embed|form|link|meta|svg|math)[^>]*>/gi, '');
    // Remove event handlers and style attributes
    out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    out = out.replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Neutralize javascript: / data: in href/src
    out = out.replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript:|data:)/gi, ' $1=$2#blocked-');
    // Drop tags not in a conservative allowlist (keep text)
    out = out.replace(
      /<\/?(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li|a|h[1-3]|blockquote|span|div)\b)[a-z0-9-]+\b[^>]*>/gi,
      '',
    );
    // Allow only http(s), mailto, relative paths on remaining anchors
    out = out.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
      const hrefMatch = String(attrs).match(/\bhref\s*=\s*(["'])(.*?)\1/i);
      if (!hrefMatch) return '<a>';
      const href = hrefMatch[2].trim();
      if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) {
        return `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer">`;
      }
      return '<a>';
    });

    return out.trim();
  }

  isBlankHtml(html) {
    return (
      String(html ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .trim().length === 0
    );
  }

  /**
   * Public home + info cards only (never swish).
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async getPublicSiteContent(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT card_key, content, meta
        FROM clubdesk_site_content
        WHERE user_id = $1
          AND card_key IN ('home', 'info')
      `,
      [ownerUserId],
    );

    const payload = {
      home: { contentHtml: '', title: '' },
      info: { contentHtml: '', title: '' },
    };

    for (const row of result.rows) {
      const key = String(row.card_key);
      if (key !== 'home' && key !== 'info') continue;
      const sanitized = this.sanitizePublicHtml(row.content);
      let meta = row.meta;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch {
          meta = {};
        }
      }
      const rawTitle =
        meta && typeof meta === 'object' && !Array.isArray(meta) ? String(meta.title ?? '') : '';
      const title = rawTitle
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim()
        .slice(0, 255);
      payload[key] = {
        contentHtml: this.isBlankHtml(sanitized) ? '' : sanitized,
        title,
      };
    }

    return payload;
  }
}

module.exports = PublicClubdeskModel;
