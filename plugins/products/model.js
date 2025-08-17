// plugins/products/model.js
// NOTE: This model supports both legacy contact-like fields and the new Product MVP fields.
//       We write both sets on create/update, and read both sets on getAll.

class ProductModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT * FROM products WHERE user_id = $1 ORDER BY COALESCE(product_number, contact_number)',
      [userId]
    );
    return result.rows.map(this.transformRow);
  }

  async create(userId, productData) {
    // Normalize incoming data: prefer new fields, fall back to legacy
    const normalized = this.normalizeInput(productData);

    const result = await this.pool.query(
      `
      INSERT INTO products (
        user_id,
        -- legacy columns
        contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, personal_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes,
        -- new MVP columns
        product_number, sku, title, description, status, quantity,
        price_amount, vat_rate, main_image, images, categories, brand, gtin
      )
      VALUES (
        $1,
        -- legacy
        $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        -- new
        $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32
      )
      RETURNING *
      `,
      [
        userId,
        // legacy
        normalized.contactNumber,
        normalized.contactType,
        normalized.companyName,
        normalized.companyType,
        normalized.organizationNumber,
        normalized.vatNumber,
        normalized.personalNumber,
        JSON.stringify(normalized.contactPersons || []),
        JSON.stringify(normalized.addresses || []),
        normalized.email,
        normalized.phone,
        normalized.phone2,
        normalized.website,
        normalized.taxRate,
        normalized.paymentTerms,
        normalized.currency,
        normalized.fTax,
        normalized.notes,
        // new
        normalized.productNumber,
        normalized.sku,
        normalized.title,
        normalized.description,
        normalized.status,
        normalized.quantity,
        normalized.priceAmount,
        normalized.vatRate,
        normalized.mainImage,
        JSON.stringify(normalized.images || []),
        JSON.stringify(normalized.categories || []),
        normalized.brand,
        normalized.gtin
      ]
    );

    return this.transformRow(result.rows[0]);
  }

  async update(userId, productId, productData) {
    const normalized = this.normalizeInput(productData);

    const result = await this.pool.query(
      `
      UPDATE products SET
        -- legacy fields
        contact_number = $1,
        contact_type = $2,
        company_name = $3,
        company_type = $4,
        organization_number = $5,
        vat_number = $6,
        personal_number = $7,
        contact_persons = $8,
        addresses = $9,
        email = $10,
        phone = $11,
        phone2 = $12,
        website = $13,
        tax_rate = $14,
        payment_terms = $15,
        currency = $16,
        f_tax = $17,
        notes = $18,

        -- new MVP fields
        product_number = $19,
        sku = $20,
        title = $21,
        description = $22,
        status = $23,
        quantity = $24,
        price_amount = $25,
        vat_rate = $26,
        main_image = $27,
        images = $28,
        categories = $29,
        brand = $30,
        gtin = $31,

        updated_at = CURRENT_TIMESTAMP
      WHERE id = $32 AND user_id = $33
      RETURNING *
      `,
      [
        // legacy
        normalized.contactNumber,
        normalized.contactType,
        normalized.companyName,
        normalized.companyType,
        normalized.organizationNumber,
        normalized.vatNumber,
        normalized.personalNumber,
        JSON.stringify(normalized.contactPersons || []),
        JSON.stringify(normalized.addresses || []),
        normalized.email,
        normalized.phone,
        normalized.phone2,
        normalized.website,
        normalized.taxRate,
        normalized.paymentTerms,
        normalized.currency,
        normalized.fTax,
        normalized.notes,

        // new
        normalized.productNumber,
        normalized.sku,
        normalized.title,
        normalized.description,
        normalized.status,
        normalized.quantity,
        normalized.priceAmount,
        normalized.vatRate,
        normalized.mainImage,
        JSON.stringify(normalized.images || []),
        JSON.stringify(normalized.categories || []),
        normalized.brand,
        normalized.gtin,

        // ids
        productId,
        userId
      ]
    );

    if (!result.rows.length) {
      throw new Error('Product not found');
    }
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, productId) {
    const result = await this.pool.query(
      'DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id',
      [productId, userId]
    );
    if (!result.rows.length) {
      throw new Error('Product not found');
    }
    return { id: productId };
  }

  normalizeInput(data = {}) {
    // Derive new fields from either new inputs or legacy ones
    const productNumber = data.productNumber ?? data.contactNumber ?? null;
    const title = data.title ?? data.companyName ?? '';
    const currency = data.currency ?? 'SEK';

    return {
      // legacy-compatible
      contactNumber: data.contactNumber ?? productNumber ?? '',
      contactType: data.contactType ?? 'company',
      companyName: data.companyName ?? title,
      companyType: data.companyType ?? '',
      organizationNumber: data.organizationNumber ?? '',
      vatNumber: data.vatNumber ?? '',
      personalNumber: data.personalNumber ?? '',
      contactPersons: data.contactPersons ?? [],
      addresses: data.addresses ?? [],
      email: data.email ?? '',
      phone: data.phone ?? '',
      phone2: data.phone2 ?? '',
      website: data.website ?? '',
      taxRate: data.taxRate ?? '', // legacy string
      paymentTerms: data.paymentTerms ?? '',
      currency,
      fTax: data.fTax ?? '',
      notes: data.notes ?? '',

      // new MVP
      productNumber,
      sku: data.sku ?? null,
      title,
      description: data.description ?? null,
      status: data.status ?? 'for sale',
      quantity: typeof data.quantity === 'number' ? data.quantity : 0,
      priceAmount: typeof data.priceAmount === 'number' ? data.priceAmount : 0,
      vatRate: typeof data.vatRate === 'number' ? data.vatRate : 25,
      mainImage: data.mainImage ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      brand: data.brand ?? null,
      gtin: data.gtin ?? null
    };
  }

  transformRow(row) {
    // Ensure arrays are arrays
    const images = Array.isArray(row.images) ? row.images : (row.images ? row.images : []);
    const categories = Array.isArray(row.categories) ? row.categories : (row.categories ? row.categories : []);

    return {
      id: row.id.toString(),

      // New MVP fields
      productNumber: row.product_number ?? null,
      sku: row.sku ?? null,
      title: row.title ?? row.company_name ?? '',
      description: row.description ?? null,
      status: row.status ?? 'for sale',
      quantity: row.quantity ?? 0,
      priceAmount: row.price_amount != null ? Number(row.price_amount) : 0,
      currency: row.currency ?? 'SEK',
      vatRate: row.vat_rate != null ? Number(row.vat_rate) : 25,
      mainImage: row.main_image ?? null,
      images,
      categories,
      brand: row.brand ?? null,
      gtin: row.gtin ?? null,

      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // Legacy fields (kept during migration)
      contactNumber: row.contact_number,
      contactType: row.contact_type,
      companyName: row.company_name,
      companyType: row.company_type || '',
      organizationNumber: row.organization_number || '',
      vatNumber: row.vat_number || '',
      personalNumber: row.personal_number || '',
      contactPersons: row.contact_persons || [],
      addresses: row.addresses || [],
      email: row.email || '',
      phone: row.phone || '',
      phone2: row.phone2 || '',
      website: row.website || '',
      taxRate: row.tax_rate || '',
      paymentTerms: row.payment_terms || '',
      fTax: row.f_tax || '',
      notes: row.notes || ''
    };
  }
}

module.exports = ProductModel;
