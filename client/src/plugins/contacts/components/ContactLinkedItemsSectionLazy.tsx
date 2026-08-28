import React, { Suspense } from 'react';

import type { Contact } from '../types/contacts';

const ContactLinkedItemsSection = React.lazy(() =>
  import('./ContactLinkedItemsSection').then((m) => ({
    default: m.ContactLinkedItemsSection,
  })),
);

export type ContactLinkedItemsSectionProps = {
  contact: Contact;
  previewLimit?: number | null;
  showHeading?: boolean;
  showHint?: boolean;
  hideWhenEmpty?: boolean;
};

/** Defers cross-plugin imports (matches, garments, teams) until the section mounts. */
export function ContactLinkedItemsSectionLazy(props: ContactLinkedItemsSectionProps) {
  return (
    <Suspense fallback={null}>
      <ContactLinkedItemsSection {...props} />
    </Suspense>
  );
}
