const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { createShipment } = require('./postnordApi');

const LABEL_MODES = ['PDF', 'ZPL', 'BOTH'];

class ShippingController {
  constructor(model) {
    this.model = model;
  }

  getAddress(order) {
    return order?.shipping_address || {};
  }

  getRecipient(order) {
    const addr = this.getAddress(order);
    const fullName = String(addr.full_name || addr.fullName || '').trim();
    const firstName = String(addr.first_name || '').trim();
    const lastName = String(addr.last_name || '').trim();
    const name = fullName || `${firstName} ${lastName}`.trim();
    const street =
      String(addr.street_address || addr.streetAddress || addr.address_1 || '').trim();
    const postalCode = String(addr.postcode || addr.postal_code || addr.postalCode || '').trim();
    const city = String(addr.city || '').trim();
    const country = String(addr.country || 'SE')
      .trim()
      .slice(0, 2)
      .toUpperCase();

    if (!name || !street || !postalCode || !city || !country) {
      throw new AppError(
        `Order ${order.id} is missing recipient fields (name, street, postalCode, city, country)`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    return { name, street, postalCode, city, country };
  }

  getLabelMode(input, settings) {
    const mode = String(input || settings?.labelFormat || 'PDF').trim().toUpperCase();
    if (!LABEL_MODES.includes(mode)) {
      throw new AppError(
        'labelFormat must be PDF, ZPL or BOTH',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return mode;
  }

  // Extracts label links/data without assuming one exact response shape.
  extractLabels(bookingJson, requestedMode) {
    const payload = bookingJson || {};
    const label = {
      pdf: null,
      zpl: null,
    };

    const assignIfString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const mode = String(requestedMode || 'PDF').toUpperCase();

    // Common direct fields used by many wrappers.
    label.pdf =
      assignIfString(payload.labelPdf) ||
      assignIfString(payload.pdf) ||
      assignIfString(payload.pdfUrl) ||
      assignIfString(payload.label_pdf);
    label.zpl =
      assignIfString(payload.labelZpl) ||
      assignIfString(payload.zpl) ||
      assignIfString(payload.zplUrl) ||
      assignIfString(payload.label_zpl);

    // Generic nested printout fields from Booking API style responses.
    const printout = payload?.printout || payload?.label?.printout || null;
    if (printout && typeof printout === 'object') {
      const format = String(printout.labelFormat || '').toUpperCase();
      const uri = assignIfString(printout.uriResource) || assignIfString(printout.uriStoreLabel);
      const data = assignIfString(printout.dataValue) || assignIfString(printout.data);
      if (format === 'PDF' && !label.pdf) label.pdf = uri || data;
      if (format === 'ZPL' && !label.zpl) label.zpl = uri || data;
    }

    // If a single generic label field is returned, map it to requested single format.
    const generic =
      assignIfString(payload.label) || assignIfString(payload.dataValue) || assignIfString(payload.data);
    if (generic) {
      if (mode === 'PDF' && !label.pdf) label.pdf = generic;
      if (mode === 'ZPL' && !label.zpl) label.zpl = generic;
    }

    return label;
  }

  getTrackingNumber(bookingJson) {
    const payload = bookingJson || {};
    return (
      payload.trackingNumber ||
      payload.tracking_number ||
      payload.itemId ||
      payload.shipmentId ||
      payload.consignmentId ||
      null
    );
  }

  async getSettings(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      return res.json(settings || null);
    } catch (error) {
      Logger.error('Shipping getSettings error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch shipping settings' });
    }
  }

  async upsertSettings(req, res) {
    try {
      const settings = await this.model.upsertSettings(req, req.body || {});
      return res.json(settings);
    } catch (error) {
      Logger.error('Shipping upsertSettings error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to save shipping settings' });
    }
  }

  async listSenders(req, res) {
    try {
      return res.json(await this.model.listSenders(req));
    } catch (error) {
      Logger.error('Shipping listSenders error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list senders' });
    }
  }

  async getSenderById(req, res) {
    try {
      const sender = await this.model.getSenderById(req, req.params.id);
      if (!sender) {
        return res.status(404).json({ error: 'Sender not found' });
      }
      return res.json(sender);
    } catch (error) {
      Logger.error('Shipping getSenderById error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch sender' });
    }
  }

  async createSender(req, res) {
    try {
      return res.json(await this.model.upsertSender(req, null, req.body || {}));
    } catch (error) {
      Logger.error('Shipping createSender error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to create sender' });
    }
  }

  async updateSender(req, res) {
    try {
      return res.json(await this.model.upsertSender(req, req.params.id, req.body || {}));
    } catch (error) {
      Logger.error('Shipping updateSender error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to update sender' });
    }
  }

  async deleteSender(req, res) {
    try {
      return res.json(await this.model.deleteSender(req, req.params.id));
    } catch (error) {
      Logger.error('Shipping deleteSender error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete sender' });
    }
  }

  async listServices(req, res) {
    try {
      return res.json(await this.model.listServices(req));
    } catch (error) {
      Logger.error('Shipping listServices error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list service presets' });
    }
  }

  async createService(req, res) {
    try {
      return res.json(await this.model.upsertService(req, null, req.body || {}));
    } catch (error) {
      Logger.error('Shipping createService error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to create service preset' });
    }
  }

  async updateService(req, res) {
    try {
      return res.json(await this.model.upsertService(req, req.params.id, req.body || {}));
    } catch (error) {
      Logger.error('Shipping updateService error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to update service preset' });
    }
  }

  async deleteService(req, res) {
    try {
      return res.json(await this.model.deleteService(req, req.params.id));
    } catch (error) {
      Logger.error('Shipping deleteService error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete service preset' });
    }
  }

  async getPostnordServices(req, res) {
    return this.listServices(req, res);
  }

  async bookPostnord(req, res) {
    try {
      const { orderIds, senderId, serviceId, labelFormat, weightsKgByOrder } = req.body || {};
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new AppError('orderIds must be a non-empty array', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const settings = await this.model.getSettings(req);
      if (!settings?.connected) {
        throw new AppError('Shipping settings are not connected', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const sender = await this.model.getSenderById(req, senderId);
      if (!sender) {
        throw new AppError('Sender not found', 404, AppError.CODES.NOT_FOUND);
      }
      const service = await this.model.getServiceById(req, serviceId);
      if (!service) {
        throw new AppError('Service preset not found', 404, AppError.CODES.NOT_FOUND);
      }

      const mode = this.getLabelMode(labelFormat, settings);
      const requestLabelFormat = mode === 'BOTH' ? 'PDF' : mode;
      const orders = await this.model.listOrdersByIds(req, orderIds);
      if (!orders.length) {
        throw new AppError('No matching orders found', 404, AppError.CODES.NOT_FOUND);
      }

      const results = [];
      const updatedOrderIds = [];

      for (const order of orders) {
        const orderId = String(order.id);
        try {
          const recipient = this.getRecipient(order);
          const requestedWeight = Number(weightsKgByOrder?.[orderId]);
          const weightKg =
            Number.isFinite(requestedWeight) && requestedWeight > 0
              ? requestedWeight
              : this.model.getDefaultWeightKg();

          const payload = {
            sender,
            recipient,
            serviceCode: service.code,
            labelFormat: requestLabelFormat,
            package: {
              weightKg,
            },
            references: {
              orderId,
              orderNumber:
                order.order_number != null
                  ? String(order.order_number)
                  : String(order.platform_order_number || order.channel_order_id || order.id),
            },
          };

          const response = await createShipment(settings, payload);
          const bookingJson = response?.json || {};
          const trackingNumber = this.getTrackingNumber(bookingJson);

          if (!trackingNumber) {
            throw new AppError(
              `PostNord response for order ${orderId} is missing tracking number`,
              502,
              AppError.CODES.EXTERNAL_SERVICE_ERROR,
            );
          }

          const extracted = this.extractLabels(bookingJson, mode);
          await this.model.updateOrderShipping(req, orderId, trackingNumber, 'PostNord', extracted);
          updatedOrderIds.push(orderId);
          results.push({
            orderId,
            trackingNumber: String(trackingNumber),
            labelPdf: extracted.pdf,
            labelZpl: extracted.zpl,
            error: null,
          });
        } catch (error) {
          results.push({
            orderId,
            trackingNumber: null,
            labelPdf: null,
            labelZpl: null,
            error: error?.message || 'Failed to book shipment',
          });
        }
      }

      return res.json({
        results,
        updatedOrderIds,
        defaultWeightKg: this.model.getDefaultWeightKg(),
      });
    } catch (error) {
      Logger.error('Shipping bookPostnord error', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to book PostNord shipments' });
    }
  }
}

module.exports = ShippingController;
