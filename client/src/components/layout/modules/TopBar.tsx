import { Plus, UserPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/context/view-mode-context";
import { useApp } from "@/context/app-context";
import { useLocation, Link } from "wouter";

export function TopBar() {
  const { viewMode } = useViewMode();
  const isClubMode = viewMode === 'club';
  const { openInvoiceCreatePanel, openContactCreatePanel, isInvoiceInEditMode, isContactInEditMode } = useApp();
  const [location] = useLocation();

  const getPageTitle = () => {
    if (location === "/") return "Dashboard";
    if (location === "/invoices") return "Invoices";
    if (location === "/contacts") return "Contacts";
    if (location === "/calendar") return "Calendar";
    if (location === "/statistics" || location === "/stats") return "Statistics";
    if (location === "/settings") return "Settings";
    if (location === "/referee/assignments") return "My Assignments";
    if (location === "/referee/profile") return "My Profile";
    if (location === "/referee/notifications") return "Notifications";
    return isClubMode ? "Referee Admin" : "Referee Portal";
  };

  const canCreateInvoice = isClubMode && (location === "/invoices" || location === "/");
  const canCreateContact = isClubMode && (location === "/contacts" || location === "/");
  const showImportButton = isClubMode && location === "/invoices";
  const showDashboardButtons = isClubMode && location === "/";
  
  // Hide buttons when in edit mode
  const isInEditMode = isInvoiceInEditMode || isContactInEditMode;

  return (
    <div className="top-bar bg-white">
      <div className="top-bar__container max-w-none">
        {/* Brand */}
        <div className="top-bar__brand">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-neutral-900">The Company 25</h1>
            <p className="text-sm text-neutral-600">{getPageTitle()}</p>
          </div>
        </div>

        {/* Spacer for centered layout */}
        <div className="flex-1"></div>

        {/* Actions */}
        <div className="top-bar__actions">
          {/* Create Buttons - Show based on current view and hide when in edit mode */}
          {!isInEditMode && canCreateInvoice && (
            <>
              <Button onClick={openInvoiceCreatePanel} variant="subtleBlue" className="px-3 py-2 text-sm">
                <Plus className="h-4 w-4" />
                <span>Create Invoice</span>
              </Button>
              {showImportButton && (
                <Link href="/invoices/import">
                  <Button variant="subtleGray" className="px-3 py-2 text-sm">
                    <Upload className="h-4 w-4" />
                    <span>Import</span>
                  </Button>
                </Link>
              )}
            </>
          )}
          
          {!isInEditMode && canCreateContact && (
            <Button onClick={openContactCreatePanel} variant="subtleBlue" className="px-3 py-2 text-sm">
              <UserPlus className="h-4 w-4" />
              <span>Add Contact</span>
            </Button>
          )}


        </div>
      </div>
    </div>
  );
}