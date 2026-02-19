// client/src/plugins/kiosk/utils/slotContactUtils.ts
// Resolve selected slots to unique contacts (for bulk message / export)

import type { Slot } from '../types/kiosk';

export interface ResolvedContact {
  id: string;
  name: string;
  phone: string;
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
  const idSet = new Set(slotIds.map(String));
  const contactMap = new Map<string, ResolvedContact>();

  for (const slot of slots) {
    if (!idSet.has(String(slot.id))) continue;
    const mentions = slot.mentions ?? [];
    for (const m of mentions) {
      const cid = String(m.contactId);
      if (contactMap.has(cid)) continue;
      const contact = contacts.find((c) => String(c.id) === cid);
      if (contact) {
        contactMap.set(cid, {
          id: cid,
          name: contact.companyName ?? m.contactName ?? m.contactId ?? cid,
          phone: (contact.phone && contact.phone.trim()) || (contact.phone2 && contact.phone2.trim()) || '',
        });
      } else {
        contactMap.set(cid, {
          id: cid,
          name: m.contactName ?? m.companyName ?? cid,
          phone: '',
        });
      }
    }
  }

  return Array.from(contactMap.values());
}
