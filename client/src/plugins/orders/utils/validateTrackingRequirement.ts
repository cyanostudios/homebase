/**
 * CDON/Fyndiq: order total meets channel threshold (299 SEK/DKK/NOK, 29.99 EUR)
 * so tracking is required when marking delivered. Our internal rule as merchants –
 * the channel APIs accept fulfill without tracking.
 */

export interface TrackingValidationError {
  field: 'trackingNumber';
  message: string;
}

function orderNeedsTrackingByAmount(totalAmount: number, currency: string): boolean {
  if (!Number.isFinite(totalAmount)) return false;
  const c = String(currency || 'SEK').trim().toUpperCase();
  if (c === 'SEK' || c === 'DKK' || c === 'NOK') return totalAmount >= 299;
  if (c === 'EUR') return totalAmount >= 29.99;
  return totalAmount >= 299;
}

export interface OrderForTrackingValidation {
  channel?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
}

/**
 * Returns validation error if CDON/Fyndiq order ≥299 (or 29.99 EUR) needs tracking
 * when setting status to delivered/shipped, and none is provided.
 */
export function validateTrackingRequirement(
  order: OrderForTrackingValidation,
  nextStatus: string,
  nextTrackingNumber: string | undefined | null,
): TrackingValidationError | null {
  const channel = String(order?.channel || '').trim().toLowerCase();
  const status = String(nextStatus || '').trim().toLowerCase();
  if (channel !== 'cdon' && channel !== 'fyndiq') return null;
  if (status !== 'delivered' && status !== 'shipped') return null;

  const total = Number(order?.totalAmount ?? 0);
  const currency = order?.currency ? String(order.currency).trim().toUpperCase() : 'SEK';
  const needsTracking = orderNeedsTrackingByAmount(total, currency);
  if (!needsTracking) return null;

  const tracking = String(nextTrackingNumber || '').trim();
  if (tracking) return null;

  return {
    field: 'trackingNumber',
    message: 'Vänligen fyll i kollinummer för denna order.',
  };
}
