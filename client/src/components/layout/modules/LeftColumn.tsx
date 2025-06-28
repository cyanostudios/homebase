import { NavigationSidebar } from "../navigation-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function LeftColumn() {
  const isMobile = useIsMobile();
  
  // On mobile, navigation is handled by MobileHeader/MobileSidebar
  if (isMobile) {
    return null;
  }
  
  return (
    <div className="w-48 flex-shrink-0">
      <NavigationSidebar />
    </div>
  );
}