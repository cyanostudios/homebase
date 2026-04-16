// plugins/orders/orderPdfPayload.js
// Build { order, ordersumma, frakt }[] for PDF templates (same logic as plocklista).

/**
 * @param {object[]} orders - Full order objects from OrdersModel.getById
 * @param {Record<string, string>|null} channelLabels - Optional map orderId -> display label
 * @returns {Array<{ order: object, ordersumma: number, frakt: number|null }>}
 */
function buildOrderPdfPayloads(orders, channelLabels) {
  return orders.map((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const channel = String(order.channel || '').toLowerCase();

    const isWooShippingItem = (it) => {
      if (channel !== 'woocommerce') return false;
      const hasProductId = it.productId != null || it.product_id != null;
      if (hasProductId) return false;
      const raw = it.raw && typeof it.raw === 'object' ? it.raw : {};
      return raw.method_id != null;
    };

    const productItems = items.filter((it) => !isWooShippingItem(it));
    const shippingItems = items.filter(isWooShippingItem);

    let ordersumma = 0;
    for (const it of productItems) {
      const qty = Number(it.quantity);
      const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
      if (Number.isFinite(qty) && Number.isFinite(unit)) ordersumma += qty * unit;
    }

    const total = order.totalAmount != null ? Number(order.totalAmount) : null;
    let frakt = null;
    if (channel === 'woocommerce' && shippingItems.length > 0) {
      let shippingSum = 0;
      for (const it of shippingItems) {
        const qty = Number(it.quantity);
        const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
        if (Number.isFinite(qty) && Number.isFinite(unit)) shippingSum += qty * unit;
      }
      frakt = Number.isFinite(shippingSum) ? shippingSum : null;
    } else if (total != null && Number.isFinite(total)) {
      frakt = total - ordersumma;
      if (frakt < 0) frakt = 0;
    }

    const platformLabel =
      channelLabels != null && order.id != null ? (channelLabels[String(order.id)] ?? null) : null;
    const orderForTemplate = {
      ...order,
      items: productItems,
      platformLabel: platformLabel || undefined,
    };
    return { order: orderForTemplate, ordersumma, frakt };
  });
}

module.exports = { buildOrderPdfPayloads };
