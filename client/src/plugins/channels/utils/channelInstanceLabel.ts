/**
 * Kort, läsbar etikett för kanalinstanser (export, importreferens m.m.).
 * Undviker upprepningar som "fyndiq · fi · fi · Finland".
 */

const MARKET_LABEL: Record<string, string> = {
  se: 'Sverige',
  dk: 'Danmark',
  fi: 'Finland',
  no: 'Norge',
};

export function formatChannelTitle(channel: string): string {
  const c = String(channel || '')
    .trim()
    .toLowerCase();
  if (c === 'woocommerce') {
    return 'WooCommerce';
  }
  if (c === 'cdon') {
    return 'CDON';
  }
  if (c === 'fyndiq') {
    return 'Fyndiq';
  }
  if (!c) {
    return '';
  }
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function secondaryName(input: {
  label: string | null | undefined;
  market: string | null | undefined;
  instanceKey: string;
}): string {
  const label = String(input.label ?? '').trim();
  if (label) {
    return label;
  }
  const m = String(input.market ?? '')
    .trim()
    .toLowerCase();
  if (m && MARKET_LABEL[m]) {
    return MARKET_LABEL[m];
  }
  if (m) {
    return m.toUpperCase();
  }
  const k = String(input.instanceKey ?? '').trim();
  if (k && MARKET_LABEL[k]) {
    return MARKET_LABEL[k];
  }
  return k;
}

export function formatChannelInstanceLabel(input: {
  channel: string;
  instanceKey: string;
  label: string | null | undefined;
  market: string | null | undefined;
  id: string | number;
}): string {
  const title = formatChannelTitle(input.channel);
  const name = secondaryName(input);
  const id = String(input.id);
  if (title && name) {
    return `${title} · ${name} (#${id})`;
  }
  if (title) {
    return `${title} (#${id})`;
  }
  if (name) {
    return `${name} (#${id})`;
  }
  return `#${id}`;
}
