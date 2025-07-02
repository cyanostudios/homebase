import { Plus, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/context/view-mode-context";
import { useApp } from "@/context/app-context";
import { useLocation } from "wouter";
import { useState } from "react";
import { MobileNavDrawer } from "./mobile-nav-drawer";

export function MobileHeader() {
  const { viewMode } = useViewMode();
  const isClubMode = viewMode === 'club';
  const { openInvoiceCreatePanel, openContactCreatePanel } = useApp();
  const [location] = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const getPageTitle = () => {
    if (location === "/") return "Dashboard";
    if (location === "/invoices") return "Invoices";
    if (location === "/contacts") return "Contacts";
    if (location === "/calendar") return "Calendar";
    if (location === "/statistics" || location === "/stats") return "Statistics";
    if (location === "/settings") return "Settings";
    return "Homebase Club";
  };

  const canCreateInvoice = isClubMode && location === "/invoices";
  const canCreateContact = isClubMode && location === "/contacts";
  const showImportButton = isClubMode && location === "/invoices";

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bg-white z-40 h-16">
        <div className="flex items-center justify-between px-4 h-full">
          {/* Left: Hamburger Menu + Page Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNavOpen(true)}
              className="p-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-base font-semibold text-neutral-900">The Company 25</h1>
              <p className="text-xs text-neutral-600">{getPageTitle()}</p>
            </div>
          </div>

          {/* Right: Action Buttons - Show based on current view */}
          <div className="flex items-center gap-2">
          {canCreateInvoice && (
              <>
                <Button
                  onClick={openInvoiceCreatePanel}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Invoice
                </Button>
                {showImportButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Import functionality to be implemented
                    }}
                  >
                    Import
                  </Button>
                )}
              </>
            )}
            
            {canCreateContact && (
              <Button
                onClick={openContactCreatePanel}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Contact
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer 
        isOpen={isNavOpen} 
        onClose={() => setIsNavOpen(false)} 
      />
    </>
  );
}