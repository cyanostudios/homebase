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
              <button
                onClick={openInvoiceCreatePanel}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                <span>Create Invoice</span>
              </button>
              {showImportButton && (
                <Link href="/invoices/import">
                  <button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-md">
                    <Upload className="h-4 w-4" />
                    <span>Import</span>
                  </button>
                </Link>
              )}
            </>
          )}
          
          {!isInEditMode && canCreateContact && (
            <button
              onClick={openContactCreatePanel}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Contact</span>
            </button>
          )}


        </div>
      </div>
    </div>
  );
}