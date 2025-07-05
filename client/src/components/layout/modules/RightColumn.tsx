import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { DetailPanelArea } from "../detail-panel-area";
import { useApp } from "@/context/app-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";

export function RightColumn() {
  const {
    isInvoicePanelOpen,
    isContactPanelOpen,
    isInvoiceCreatePanelOpen,
    currentContact,
    closeContactPanel,
  } = useApp();
  const isMobile = useIsMobile();
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  const isPanelOpen = isInvoicePanelOpen || isContactPanelOpen || isInvoiceCreatePanelOpen;

  useEffect(() => {
    if (isPanelOpen && !hasBeenOpened) {
      setHasBeenOpened(true);
    } else if (!isPanelOpen && hasBeenOpened) {
      setHasBeenOpened(false);
    }
  }, [isPanelOpen, hasBeenOpened]);

  if (isMobile && isContactPanelOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-hidden">
        <DetailPanelArea />
      </div>
    );
  }

  if (isMobile || !isContactPanelOpen) {
    return null;
  }

  return (
    <UniversalPanel
      isOpen={isContactPanelOpen}
      onClose={closeContactPanel}
      title="Contact"
      subtitle="Manage contact information"
      width="672px"
    >
      <DetailPanelArea />
    </UniversalPanel>
  );
}