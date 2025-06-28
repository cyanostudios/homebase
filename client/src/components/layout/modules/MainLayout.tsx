import { TopBar } from "./TopBar";
import { LeftColumn } from "./LeftColumn";
import { MiddleColumn } from "./MiddleColumn";
import { RightColumn } from "./RightColumn";
import { MobileBottomTabs } from "./MobileBottomTabs";
import { MobileHeader } from "../mobile-header";
import { useIsMobile } from "@/hooks/use-mobile";
import { useApp } from "@/context/app-context";

export function MainLayout() {
  const isMobile = useIsMobile();
  const { 
    isInvoicePanelOpen, 
    isContactPanelOpen, 
    isInvoiceCreatePanelOpen, 
    isContactCreatePanelOpen 
  } = useApp();

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden">
      {/* Headers */}
      {isMobile ? <MobileHeader /> : <TopBar />}
      
      {/* Main content area with proper responsive padding */}
      <div className={`flex h-full relative ${isMobile ? 'pt-16 pb-16' : 'pt-14'}`}>
        {/* Left Column - Navigation (hidden on mobile since we use bottom tabs) */}
        {!isMobile && <LeftColumn />}
        
        {/* Middle Column - Content (always uses full available space) */}
        <div className="flex-1">
          <MiddleColumn />
        </div>
        
        {/* Right Column - Detail Panels (overlays on top from right) */}
        <RightColumn />
      </div>
      
      {/* Mobile Bottom Tabs - only show on mobile */}
      {isMobile && <MobileBottomTabs />}
    </div>
  );
}