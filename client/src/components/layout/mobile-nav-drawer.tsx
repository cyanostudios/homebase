import { useState } from "react";
import { X, Settings, LogOut, UserCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useViewMode } from "@/context/view-mode-context";
import { cn } from "@/lib/utils";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const { viewMode } = useViewMode();
  const [location] = useLocation();
  const isClubMode = viewMode === "club";

  const clubNavItems = [
    { href: "/", label: "Dashboard" },
    { href: "/invoices", label: "Invoices" },
    { href: "/calendar", label: "Calendar" },
    { href: "/contacts", label: "Contacts" },
    { href: "/stats", label: "Statistics" },
  ];

  const contactNavItems = [
    { href: "/contact/assignments", label: "Assignments" },
    { href: "/contact/profile", label: "Profile" },
  ];

  const navItems = isClubMode ? clubNavItems : contactNavItems;

  const handleLogout = () => {
    if (!isClubMode) {
      localStorage.removeItem("contactId");
      localStorage.removeItem("contactName");
      localStorage.setItem("viewMode", "club");
      window.location.href = "/";
    }
    onClose();
  };

  const handleNavItemClick = () => {
    onClose();
  };

  const handleViewModeSwitch = () => {
    if (isClubMode) {
      localStorage.setItem("contactId", "5");
      localStorage.setItem("contactName", "Maria Johansson");
      localStorage.setItem("viewMode", "contact");
      window.location.href = "/contact/assignments";
    } else {
      localStorage.removeItem("contactId");
      localStorage.removeItem("contactName");
      localStorage.setItem("viewMode", "club");
      window.location.href = "/";
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold">Navigation</h2>
          <Button onClick={onClose} variant="subtleGray" size="icon" className="p-2">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg",
                    location === item.href
                      ? "bg-blue-100 text-blue-700"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                  onClick={handleNavItemClick}
                >
                  <span>{item.label}</span>
                </div>
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-neutral-200 space-y-2">
          {/* Settings */}
          <Link href="/settings">
            <div 
              className={cn(
                "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg",
                location === "/settings" 
                  ? "bg-blue-100 text-blue-700" 
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
              onClick={handleNavItemClick}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </div>
          </Link>

          {/* View Mode Switch */}
          <div 
            className="flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            onClick={handleViewModeSwitch}
          >
            {isClubMode ? (
              <UserCheck className="h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            <span>
              {isClubMode ? "Switch to Contact" : "Switch to Club"}
            </span>
          </div>

          {/* Logout */}
          <div 
            className="flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </div>
        </div>
      </div>
    </>
  );
}