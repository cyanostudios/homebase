/**
 * Display label for order status. Shipped and delivered both show as "Delivered".
 * No logic change – backend still uses shipped/delivered.
 */
export function statusDisplayLabel(status: string | null | undefined): string {
  if ((status ?? null) === null || status === '') {
    return '';
  }
  const s = String(status).toLowerCase();
  if (s === 'shipped' || s === 'delivered') {
    return 'Delivered';
  }
  if (s === 'processing') {
    return 'Processing';
  }
  if (s === 'cancelled') {
    return 'Cancelled';
  }
  return status;
}
