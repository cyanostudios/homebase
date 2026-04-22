import type { ChannelInstance } from '../types/channels';

/** Dropdown label per channel. WooCommerce: `inst.label` only. */
export function formatChannelInstanceLabel(inst: ChannelInstance): string {
  const ch = String(inst.channel || '').toLowerCase();
  const label = inst.label?.trim();
  const market = inst.market?.trim();
  if (ch === 'woocommerce') {
    return label ?? '';
  }
  if (ch === 'cdon') {
    return market
      ? `CDON ${market.toUpperCase()}`
      : label || `CDON (${inst.instanceKey || inst.id})`;
  }
  if (ch === 'fyndiq') {
    return market
      ? `Fyndiq ${market.toUpperCase()}`
      : label || `Fyndiq (${inst.instanceKey || inst.id})`;
  }
  return label || `${inst.channel} (${inst.id})`;
}
