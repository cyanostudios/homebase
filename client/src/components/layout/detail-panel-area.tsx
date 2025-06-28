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
    isContactCreatePanelOpen,
    closeInvoiceCreatePanel,
    closeContactCreatePanel,
    currentContact,
    closeContactPanel
  } = useApp();
  const isMobile = useIsMobile();
  
  // Local state for contact panel mode
  const [contactPanelMode, setContactPanelMode] = useState<"view" | "edit">("view");
  
  // Reset to view mode when contact panel opens
  useEffect(() => {
    if (isContactPanelOpen && currentContact) {
      setContactPanelMode("view");
    }
  }, [isContactPanelOpen, currentContact?.id]);
  
  // Handle mode changes - filter out "create" since it's handled separately
  const handleContactModeChange = (mode: "create" | "edit" | "view") => {
    if (mode !== "create") {
      setContactPanelMode(mode);
    }
  };

  // Mobile gets same functionality as desktop
  if (isMobile) {
    // Show only one panel at a time - same priority order as desktop
    let activePanel = null;
    
    if (isInvoiceCreatePanelOpen) {
      activePanel = <InvoiceCreatePanel isOpen={isInvoiceCreatePanelOpen} onClose={closeInvoiceCreatePanel} />;
    } else if (isContactCreatePanelOpen) {
      activePanel = <ContactPanel mode="create" isOpen={isContactCreatePanelOpen} onClose={closeContactCreatePanel} />;
    } else if (isInvoicePanelOpen) {
      activePanel = <InvoiceDetailPanel />;
    } else if (isContactPanelOpen) {
      activePanel = (
        <ContactPanel 
          mode={contactPanelMode} 
          isOpen={isContactPanelOpen} 
          onClose={closeContactPanel} 
          contactId={currentContact?.id}
          onModeChange={handleContactModeChange}
        />
      );
    }

    return (
      <div className="w-full h-full overflow-hidden">
        <div className="h-full overflow-auto">
          {activePanel}
        </div>
      </div>
    );
  }

  // On desktop, render panels directly for the slide-in column



  // Show only one panel at a time - priority order: create panels first, then detail panels
  let activePanel = null;
  let activePanelType = null;
  
  if (isInvoiceCreatePanelOpen) {
    activePanel = <InvoiceCreatePanel isOpen={isInvoiceCreatePanelOpen} onClose={closeInvoiceCreatePanel} />;
    activePanelType = "InvoiceCreate";
  } else if (isContactCreatePanelOpen) {
    activePanel = <ContactPanel mode="create" isOpen={isContactCreatePanelOpen} onClose={closeContactCreatePanel} />;
    activePanelType = "ContactCreate";
  } else if (isInvoicePanelOpen) {
    activePanel = <InvoiceDetailPanel />;
    activePanelType = "InvoiceDetail";
  } else if (isContactPanelOpen) {
    activePanel = (
      <ContactPanel 
        mode={contactPanelMode} 
        isOpen={isContactPanelOpen} 
        onClose={closeContactPanel} 
        contactId={currentContact?.id}
        onModeChange={handleContactModeChange}
      />
    );
    activePanelType = "ContactDetail";
  }



  return (
    <div className="w-full h-full overflow-hidden">
      <div className="h-full overflow-auto">
        {activePanel}
      </div>
    </div>
  );
}