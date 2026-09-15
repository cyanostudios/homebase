export type ContactPersonInvoiceRef = {
  id?: string | number;
  name?: string | null;
  invoiceReference?: boolean;
};

/** Prefer explicitly flagged person; otherwise first non-empty name (legacy). */
export function pickInvoiceReferencePersonName(contactPersons: unknown): string {
  if (!Array.isArray(contactPersons) || contactPersons.length === 0) {
    return '';
  }
  const persons = contactPersons as ContactPersonInvoiceRef[];
  for (const person of persons) {
    if (!person || typeof person !== 'object' || person.invoiceReference !== true) {
      continue;
    }
    const name = String(person.name || '').trim();
    if (name) {
      return name;
    }
  }
  for (const person of persons) {
    if (!person || typeof person !== 'object') {
      continue;
    }
    const name = String(person.name || '').trim();
    if (name) {
      return name;
    }
  }
  return '';
}

/**
 * Whether this person is explicitly marked as the invoice reference.
 * (Invoice PDF still falls back to the first named person when none are flagged.)
 */
export function isContactPersonInvoiceReference(
  contactPersons: ContactPersonInvoiceRef[] | undefined,
  personId: string | number,
): boolean {
  const persons = Array.isArray(contactPersons) ? contactPersons : [];
  const person = persons.find((row) => String(row?.id) === String(personId));
  return person?.invoiceReference === true;
}

/** Set or clear invoice reference on one person (at most one flagged). */
export function withContactPersonInvoiceReference<T extends ContactPersonInvoiceRef>(
  contactPersons: T[],
  personId: string | number,
  selected: boolean,
): T[] {
  return contactPersons.map((person) => {
    const isTarget = String(person.id) === String(personId);
    if (selected) {
      return { ...person, invoiceReference: isTarget };
    }
    if (isTarget) {
      return { ...person, invoiceReference: false };
    }
    return person;
  });
}

export function buildContactPersonsInvoiceReferenceSavePayload<
  T extends { contactPersons?: ContactPersonInvoiceRef[] },
>(contact: T, personId: string | number, selected: boolean): T {
  const persons = Array.isArray(contact.contactPersons) ? contact.contactPersons : [];
  return {
    ...contact,
    contactPersons: withContactPersonInvoiceReference(persons, personId, selected),
  };
}
