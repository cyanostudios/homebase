import { DetailPanelArea } from "../detail-panel-area";
import { useApp } from "@/context/app-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";

export function RightColumn() {
  const { 
    isInvoicePanelOpen, 
    isContactPanelOpen, 
    isInvoiceCreatePanelOpen, 
    isContactCreatePanelOpen 
  } = useApp();
  const isMobile = useIsMobile();
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  const isPanelOpen = isInvoicePanelOpen || isContactPanelOpen || isInvoiceCreatePanelOpen || isContactCreatePanelOpen;

  // Track if panel has been opened to control slide animation - must be before conditional returns
  useEffect(() => {
    if (isPanelOpen && !hasBeenOpened) {
      setHasBeenOpened(true);
    } else if (!isPanelOpen) {
      setHasBeenOpened(false);
    }
  }, [isPanelOpen, hasBeenOpened]);

  // On mobile, panels overlay as full-screen modals
  if (isMobile && isPanelOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <DetailPanelArea />
      </div>
    );
  }

  // Don't render anything on mobile when no panel is open
  if (isMobile) {
    return null;
  }

  return (
    <div 
      className={`absolute right-0 top-0 bottom-0 w-748 bg-white border-l border-neutral-200 z-50 shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <DetailPanelArea />
    </div>
  );
}