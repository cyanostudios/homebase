import React from 'react';

/** Hides row/select-all checkboxes on mobile; selection UI is desktop-only. */
export function ListSelectionCheckboxSlot({ children }: { children?: React.ReactNode }) {
  if (!children) {
    return null;
  }
  return <div className="hidden md:flex">{children}</div>;
}
