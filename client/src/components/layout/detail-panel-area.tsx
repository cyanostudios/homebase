import { useState, useEffect } from "react";
import { useApp } from "@/context/app-context";
import { InvoiceDetailPanel } from "@/components/invoices/invoice-detail-panel";
import { ContactPanel } from "@/components/contacts/ContactPanel";
import { InvoiceCreatePanel } from "@/components/invoices/invoice-create-panel";
import { useIsMobile } from "@/hooks/use-mobile";

export function DetailPanelArea() {
  const {
    isInvoicePanelOpen,
    isContactPanelOpen,
    isInvoiceCreatePanelOpen,
    closeInvoiceCreatePanel,
    closeContactPanel,
    closeInvoicePanel,
    currentContact,
    currentInvoice,
    contactPanelMode,
  } = useApp();

  // Show only one panel at a time - priority order: create panels first, then detail panels
  let activePanel = null;

  if (isInvoiceCreatePanelOpen) {
    activePanel = <InvoiceCreatePanel isOpen={isInvoiceCreatePanelOpen} onClose={closeInvoiceCreatePanel} />;
  } else if (isContactPanelOpen) {
    // Render ContactPanel content WITHOUT its own header/wrapper
    activePanel = <ContactPanel />;
  } else if (isInvoicePanelOpen) {
    activePanel = <InvoiceDetailPanel />;
  }

  // Don't render anything if no panel is open
  if (!activePanel) return null;

  // ONLY return the content - UniversalPanel handles header/wrapper
  return (
    <div className="h-full">
      {activePanel}
    </div>
  );
}