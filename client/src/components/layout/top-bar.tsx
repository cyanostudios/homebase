
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Settings } from "lucide-react";
import { useApp } from "@/context/app-context";
import { useViewMode } from "@/context/view-mode-context";
import { Link } from "wouter";

export function TopBar() {
  const { openInvoiceCreatePanel, openContactCreatePanel } = useApp();
  const { viewMode } = useViewMode();

  const isClubMode = viewMode === "club";

  return (
    <div className="top-bar">
      <div className="top-bar__container">
        {/* Left: App Title */}
        <div className="top-bar__brand">
          <h1 className="top-bar__title">
            {isClubMode ? "Club Manager" : "Referee Portal"}
          </h1>
        </div>

        {/* Center: Search */}
        <div className="top-bar__search">
          <div className="top-bar__search-wrapper">
            <Search className="top-bar__search-icon" />
            <Input
              placeholder="Search invoices, contacts..."
              className="top-bar__search-input"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="top-bar__actions">
          {isClubMode && (
            <>
              <Button 
                onClick={openInvoiceCreatePanel}
                size="sm"
                className="top-bar__primary-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Invoice
              </Button>
              <Button 
                onClick={openContactCreatePanel}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </>
          )}

          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
          </Button>

          <Link href="/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
