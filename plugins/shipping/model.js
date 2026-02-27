const { Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const DEFAULT_WEIGHT_KG = 0.15;
const LABEL_FORMATS = ['PDF', 'ZPL', 'BOTH'];

class ShippingModel {
  static SETTINGS_TABLE = 'postnord_settings';
  static SENDERS_TABLE = 'shipping_senders';
  static SERVICES_TABLE = 'shipping_service_presets';
  static ORDERS_TABLE = 'orders';

  getUserId(req) {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
    }
    return userId;
  }

  transformSettings(row) {
    if (!row) return null;
    const labelFormat = String(row.label_format || 'PDF').toUpperCase();
    return {
      bookingUrl: row.booking_url || '',
      authScheme: row.auth_scheme || '',
      integrationId: row.integration_id || '',
      apiKey: row.api_key || '',
      apiSecret: row.api_secret || '',
      apiKeyHeaderName: row.api_key_header_name || '',
      labelFormat: LABEL_FORMATS.includes(labelFormat) ? labelFormat : 'PDF',
      connected: !!row.connected,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  transformSender(row) {
    return {
      id: String(row.id),
      name: row.name,
      street: row.street || '',
      postalCode: row.postal_code || '',
      city: row.city || '',
      country: row.country || 'SE',
      contactName: row.contact_name || '',
      contactPhone: row.contact_phone || '',
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  transformService(row) {
    return {
      id: String(row.id),
      code: row.code,
      name: row.name,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  async getSettings(req) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `SELECT * FROM ${ShippingModel.SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return rows.length ? this.transformSettings(rows[0]) : null;
  }

  async upsertSettings(req, data) {
    const db = Database.get(req);
    const userId = this.getUserId(req);

    const bookingUrl = String(data?.bookingUrl || '').trim() || null;
    const authScheme = String(data?.authScheme || '').trim().toUpperCase() || null;
    const integrationId = String(data?.integrationId || '').trim() || null;
    const apiKey = String(data?.apiKey || '').trim() || null;
    const apiSecret = String(data?.apiSecret || '').trim() || null;
    const apiKeyHeaderName = String(data?.apiKeyHeaderName || '').trim() || null;
    const rawLabelFormat = String(data?.labelFormat || 'PDF').trim().toUpperCase() || 'PDF';
    const labelFormat = LABEL_FORMATS.includes(rawLabelFormat) ? rawLabelFormat : 'PDF';
    const connected = !!(bookingUrl && authScheme && apiKey);

    const rows = await db.query(
      `
      INSERT INTO ${ShippingModel.SETTINGS_TABLE}
        (user_id, booking_url, auth_scheme, integration_id, api_key, api_secret, api_key_header_name, label_format, connected, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        booking_url = EXCLUDED.booking_url,
        auth_scheme = EXCLUDED.auth_scheme,
        integration_id = EXCLUDED.integration_id,
        api_key = EXCLUDED.api_key,
        api_secret = EXCLUDED.api_secret,
        api_key_header_name = EXCLUDED.api_key_header_name,
        label_format = EXCLUDED.label_format,
        connected = EXCLUDED.connected,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        userId,
        bookingUrl,
        authScheme,
        integrationId,
        apiKey,
        apiSecret,
        apiKeyHeaderName,
        labelFormat,
        connected,
      ],
    );

    return this.transformSettings(rows[0]);
  }

  async listSenders(req) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `SELECT * FROM ${ShippingModel.SENDERS_TABLE} WHERE user_id = $1 ORDER BY name ASC, id ASC`,
      [userId],
    );
    return rows.map((r) => this.transformSender(r));
  }

  async getSenderById(req, id) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `SELECT * FROM ${ShippingModel.SENDERS_TABLE} WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, Number(id)],
    );
    return rows.length ? this.transformSender(rows[0]) : null;
  }

  async upsertSender(req, id, data) {
    const db = Database.get(req);
    const userId = this.getUserId(req);

    const payload = {
      name: String(data?.name || '').trim(),
      street: String(data?.street || '').trim() || null,
      postalCode: String(data?.postalCode || '').trim() || null,
      city: String(data?.city || '').trim() || null,
      country: (String(data?.country || 'SE').trim().slice(0, 2) || 'SE').toUpperCase(),
      contactName: String(data?.contactName || '').trim() || null,
      contactPhone: String(data?.contactPhone || '').trim() || null,
    };
    if (!payload.name) {
      throw new AppError('Sender name is required', 400, AppError.CODES.VALIDATION_ERROR);
    }

    if (id != null) {
      const rows = await db.query(
        `
        UPDATE ${ShippingModel.SENDERS_TABLE}
        SET
          name = $3,
          street = $4,
          postal_code = $5,
          city = $6,
          country = $7,
          contact_name = $8,
          contact_phone = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND id = $2
        RETURNING *
        `,
        [
          userId,
          Number(id),
          payload.name,
          payload.street,
          payload.postalCode,
          payload.city,
          payload.country,
          payload.contactName,
          payload.contactPhone,
        ],
      );
      if (!rows.length) {
        throw new AppError('Sender not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformSender(rows[0]);
    }

    const rows = await db.query(
      `
      INSERT INTO ${ShippingModel.SENDERS_TABLE}
        (user_id, name, street, postal_code, city, country, contact_name, contact_phone, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [
        userId,
        payload.name,
        payload.street,
        payload.postalCode,
        payload.city,
        payload.country,
        payload.contactName,
        payload.contactPhone,
      ],
    );
    return this.transformSender(rows[0]);
  }

  async deleteSender(req, id) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `DELETE FROM ${ShippingModel.SENDERS_TABLE} WHERE user_id = $1 AND id = $2 RETURNING id`,
      [userId, Number(id)],
    );
    if (!rows.length) {
      throw new AppError('Sender not found', 404, AppError.CODES.NOT_FOUND);
    }
    return { id: String(rows[0].id) };
  }

  async listServices(req) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `SELECT * FROM ${ShippingModel.SERVICES_TABLE} WHERE user_id = $1 ORDER BY name ASC, id ASC`,
      [userId],
    );
    return rows.map((r) => this.transformService(r));
  }

  async getServiceById(req, id) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `SELECT * FROM ${ShippingModel.SERVICES_TABLE} WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, Number(id)],
    );
    return rows.length ? this.transformService(rows[0]) : null;
  }

  async upsertService(req, id, data) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const code = String(data?.code || '').trim();
    const name = String(data?.name || '').trim();
    if (!code || !name) {
      throw new AppError('Service code and name are required', 400, AppError.CODES.VALIDATION_ERROR);
    }

    if (id != null) {
      const rows = await db.query(
        `
        UPDATE ${ShippingModel.SERVICES_TABLE}
        SET code = $3, name = $4, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND id = $2
        RETURNING *
        `,
        [userId, Number(id), code, name],
      );
      if (!rows.length) {
        throw new AppError('Service not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformService(rows[0]);
    }

    const rows = await db.query(
      `
      INSERT INTO ${ShippingModel.SERVICES_TABLE}
        (user_id, code, name, created_at, updated_at)
      VALUES
        ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [userId, code, name],
    );
    return this.transformService(rows[0]);
  }

  async deleteService(req, id) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    const rows = await db.query(
      `DELETE FROM ${ShippingModel.SERVICES_TABLE} WHERE user_id = $1 AND id = $2 RETURNING id`,
      [userId, Number(id)],
    );
    if (!rows.length) {
      throw new AppError('Service not found', 404, AppError.CODES.NOT_FOUND);
    }
    return { id: String(rows[0].id) };
  }

  async listOrdersByIds(req, ids) {
    const db = Database.get(req);
    const userId = this.getUserId(req);
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!validIds.length) return [];

    return db.query(
      `
      SELECT id, order_number, channel_order_id, platform_order_number, shipping_address, customer, total_amount, currency, raw
      FROM ${ShippingModel.ORDERS_TABLE}
      WHERE user_id = $1 AND id = ANY($2::int[])
      ORDER BY id ASC
      `,
      [userId, validIds],
    );
  }

  async updateOrderShipping(req, orderId, trackingNumber, carrier, labelData) {
    const db = Database.get(req);
    const userId = this.getUserId(req);

    const labelJson = labelData
      ? JSON.stringify({
          pdf: labelData.pdf || null,
          zpl: labelData.zpl || null,
          updatedAt: new Date().toISOString(),
        })
      : null;

    await db.query(
      `
      UPDATE ${ShippingModel.ORDERS_TABLE}
      SET
        shipping_carrier = $3,
        shipping_tracking_number = $4,
        raw = CASE
          WHEN $5::jsonb IS NULL THEN raw
          ELSE COALESCE(raw, '{}'::jsonb) || jsonb_build_object('shipping_labels', $5::jsonb)
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND id = $2
      `,
      [
        userId,
        Number(orderId),
        String(carrier || ''),
        String(trackingNumber || ''),
        labelJson,
      ],
    );
  }

  getDefaultWeightKg() {
    return DEFAULT_WEIGHT_KG;
  }
}

module.exports = ShippingModel;
