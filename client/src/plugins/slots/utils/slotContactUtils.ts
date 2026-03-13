// client/src/plugins/slots/utils/slotContactUtils.ts
// Resolve selected slots to unique contacts (for bulk message / export)

import type { Slot, SlotMention } from '../types/slots';

export interface ResolvedContact {
  id: string;
  name: string;
  phone: string;
}

export interface ResolvedEmailContact {
  id: string;
  name: string;
  email: string;
}

function resolveSlotMentionsToRecipients<C, R>(
  slotIds: string[],
  slots: Slot[],
  contacts: C[],
  getId: (c: C) => string | number,
  mapContact: (cid: string, m: SlotMention, contact: C | undefined) => R,
): R[] {
  const idSet = new Set(slotIds.map(String));
  const resultMap = new Map<string, R>();

  for (const slot of slots) {
    if (!idSet.has(String(slot.id))) {
      continue;
    }
    const mentions = slot.mentions ?? [];
    for (const m of mentions) {
      const cid = String(m.contactId);
      if (resultMap.has(cid)) {
        continue;
      }
      const contact = contacts.find((c) => String(getId(c)) === cid);
      resultMap.set(cid, mapContact(cid, m, contact));
    }
  }

  return Array.from(resultMap.values());
}

/**
 * From selected slot IDs and the slots list, collect all unique contacts
 * from slot mentions. Enrich with phone from the contacts list.
 * Returns array suitable for BulkMessageDialog recipients.
 */
export function resolveSlotsToContacts(
  slotIds: string[],
  slots: Slot[],
  contacts: Array<{ id: string | number; companyName?: string; phone?: string; phone2?: string }>,
): ResolvedContact[] {
  return resolveSlotMentionsToRecipients(
    slotIds,
    slots,
    contacts,
    (c) => c.id,
    (cid, m, contact) => ({
      id: cid,
      name: contact
        ? (contact.companyName ?? m.contactName ?? m.contactId ?? cid)
        : (m.contactName ?? m.companyName ?? cid),
      phone: contact
        ? (contact.phone && contact.phone.trim()) || (contact.phone2 && contact.phone2.trim()) || ''
        : '',
    }),
  );
}

/**
 * From selected slot IDs and the slots list, collect all unique contacts
 * from slot mentions. Enrich with email from the contacts list.
 * Returns array suitable for BulkEmailDialog recipients.
 */
export function resolveSlotsToEmailContacts(
  slotIds: string[],
  slots: Slot[],
  contacts: Array<{ id: string | number; companyName?: string; email?: string }>,
): ResolvedEmailContact[] {
  return resolveSlotMentionsToRecipients(
    slotIds,
    slots,
    contacts,
    (c) => c.id,
    (cid, m, contact) => ({
      id: cid,
      name: contact
        ? (contact.companyName ?? m.contactName ?? m.contactId ?? cid)
        : (m.contactName ?? m.companyName ?? cid),
      email: contact?.email?.trim() ?? '',
    }),
  );
}

/**
 * Format slot information as text (for email body).
 */
export function formatSlotInfoText(slot: Slot, locale: string = 'sv-SE'): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('Slot Information:');

  if (slot.location) {
    lines.push(`Location: ${slot.location}`);
  }

  if (slot.slot_time) {
    const date = new Date(slot.slot_time);
    lines.push(
      `Time: ${date.toLocaleDateString(locale, { dateStyle: 'long' })} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`,
    );
  }

  lines.push(`Capacity: ${slot.capacity}`);

  return lines.join('\n');
}

/**
 * Format slot information as HTML (for email body).
 */
export function formatSlotInfoHtml(slot: Slot, locale: string = 'sv-SE'): string {
  const rows: string[] = [];

  if (slot.location) {
    rows.push(
      `<tr><td style="padding:4px 8px;color:#666;">Location:</td><td style="padding:4px 8px;">${slot.location}</td></tr>`,
    );
  }

  if (slot.slot_time) {
    const date = new Date(slot.slot_time);
    const formattedDate = `${date.toLocaleDateString(locale, { dateStyle: 'long' })} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`;
    rows.push(
      `<tr><td style="padding:4px 8px;color:#666;">Time:</td><td style="padding:4px 8px;">${formattedDate}</td></tr>`,
    );
  }

  rows.push(
    `<tr><td style="padding:4px 8px;color:#666;">Capacity:</td><td style="padding:4px 8px;">${slot.capacity}</td></tr>`,
  );

  return `
<hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
<table style="font-family:sans-serif;font-size:14px;">
  <thead>
    <tr><th colspan="2" style="text-align:left;padding:8px;background:#f5f5f5;border-radius:4px;">Slot Information</th></tr>
  </thead>
  <tbody>
    ${rows.join('\n    ')}
  </tbody>
</table>`;
}
