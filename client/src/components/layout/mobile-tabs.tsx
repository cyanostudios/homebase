import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MobileTabProps {
  href: string;
  icon: string;
  children: React.ReactNode;
  active?: boolean;
}

function MobileTab({ href, icon, children, active }: MobileTabProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center p-2 transition-colors",
        active ? "text-primary-600 bg-primary-50" : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      <span className="material-icons text-xl sm:text-2xl">{icon}</span>
      <span className="text-xs sm:text-sm mt-1 font-medium">{children}</span>
    </Link>
  );
}

export function MobileTabNavigation() {
  const [location] = useLocation();

  return (
    <nav className="bg-white border-t border-neutral-200 md:hidden">
      <div className="grid grid-cols-5 h-16 sm:h-20">
        <MobileTab href="/" icon="dashboard" active={location === "/"}>
          Dashboard
        </MobileTab>
        <MobileTab href="/invoices" icon="event" active={location === "/invoices"}>
          Invoices
        </MobileTab>
        <MobileTab href="/contacts" icon="sports" active={location === "/contacts"}>
          Contacts
        </MobileTab>
        <MobileTab href="/statistics" icon="bar_chart" active={location === "/statistics"}>
          Stats
        </MobileTab>
        <MobileTab href="/settings" icon="settings" active={location === "/settings"}>
          Settings
        </MobileTab>
      </div>
    </nav>
  );
}
