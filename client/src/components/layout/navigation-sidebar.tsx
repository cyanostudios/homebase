import { Link, useLocation } from "wouter";
import { useViewMode } from "@/context/view-mode-context";
import { 
  Home, 
  Calendar, 
  Users, 
  BarChart3, 
  Settings,
  User,
  Trophy,
  LogOut,
  Building2,
  UserCheck,
  RefreshCw,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@shared/schema";
import { useEffect, useState } from "react";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  colorClass?: string;
  hoverColorClass?: string;
  activeColorClass?: string;
}

function NavItem({ href, icon, label, isActive, colorClass = "text-neutral-600", hoverColorClass = "hover:bg-neutral-100", activeColorClass = "bg-blue-50" }: NavItemProps) {

  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer nav-item-rounded",
        isActive 
          ? `${activeColorClass} text-neutral-900` 
          : `text-neutral-900 ${hoverColorClass}`
      )}>
        <span className={colorClass}>{icon}</span>
        <span>{label}</span>
      </div>
    </Link>
  );
}

export function NavigationSidebar() {
  const { viewMode } = useViewMode();
  const [location] = useLocation();
  const isClubMode = viewMode === "club";
  const [contactId, setContactId] = useState<number | null>(null);
  
  // Get contact ID from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem("contactId");
    if (storedId) {
      setContactId(Number(storedId));
    }
  }, [viewMode]);
  
  // Fetch current contact data for display
  const { data: contact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: !!contactId && !isClubMode,
  });

  const clubNavItems = [
    { href: "/", icon: <Home className="h-4 w-4" />, label: "Dashboard", colorClass: "text-gray-700", hoverColorClass: "hover:bg-gray-50", activeColorClass: "bg-gray-50" },
    { href: "/invoices", icon: <Building2 className="h-4 w-4" />, label: "Invoices", colorClass: "text-green-500", hoverColorClass: "hover:bg-green-50", activeColorClass: "bg-green-50" },
    { href: "/calendar", icon: <Calendar className="h-4 w-4" />, label: "Calendar", colorClass: "text-blue-400", hoverColorClass: "hover:bg-blue-50", activeColorClass: "bg-blue-50" },
    { href: "/contacts", icon: <Users className="h-4 w-4" />, label: "Contacts", colorClass: "text-yellow-500", hoverColorClass: "hover:bg-yellow-50", activeColorClass: "bg-yellow-50" },
    { href: "/stats", icon: <BarChart3 className="h-4 w-4" />, label: "Statistics", colorClass: "text-purple-500", hoverColorClass: "hover:bg-purple-50", activeColorClass: "bg-purple-50" },
  ];

  const contactNavItems = [
    { href: "/contact/dashboard", icon: <Home className="h-4 w-4" />, label: "Overview", colorClass: "text-gray-700", hoverColorClass: "hover:bg-gray-50", activeColorClass: "bg-gray-50" },
    { href: "/contact/notifications", icon: <Bell className="h-4 w-4" />, label: "Notifications", colorClass: "text-orange-500", hoverColorClass: "hover:bg-orange-50", activeColorClass: "bg-orange-50" },
    { href: "/contact/assignments", icon: <Trophy className="h-4 w-4" />, label: "Assignments", colorClass: "text-green-500", hoverColorClass: "hover:bg-green-50", activeColorClass: "bg-green-50" },
    { href: "/contact/profile", icon: <User className="h-4 w-4" />, label: "Profile", colorClass: "text-blue-500", hoverColorClass: "hover:bg-blue-50", activeColorClass: "bg-blue-50" },
  ];

  const navItems = isClubMode ? clubNavItems : contactNavItems;

  const handleLogout = () => {
    if (!isClubMode) {
      localStorage.removeItem("contactId");
      localStorage.removeItem("contactName");
      localStorage.setItem("viewMode", "club");
      window.location.href = "/";
    }
  };

  const getUserName = () => {
    if (isClubMode) {
      return "Johan Andersson";
    } else {
      return contact?.fullName || localStorage.getItem("contactName") || "Contact";
    }
  };

  return (
    <div className="w-48 flex-shrink-0 h-full flex flex-col">
      <div className="flex-1 p-4">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={location === item.href}
              colorClass={item.colorClass}
              hoverColorClass={item.hoverColorClass}
              activeColorClass={item.activeColorClass}
            />
          ))}
        </nav>
      </div>

      {/* Bottom section with divider */}
      <div className="border-t border-neutral-200">
        <div className="p-4 space-y-2">
          {/* View Mode Switch Button */}
          <div className={cn(
            "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer nav-item-rounded",
            "text-neutral-900 hover:bg-indigo-50"
          )} onClick={() => {
            if (isClubMode) {
              // Switch to contact mode with Maria as example
              localStorage.setItem("contactId", "5");
              localStorage.setItem("contactName", "Maria Johansson");
              localStorage.setItem("viewMode", "contact");
              window.location.href = "/contact/assignments";
            } else {
              // Switch to club mode
              localStorage.removeItem("contactId");
              localStorage.removeItem("contactName");
              localStorage.setItem("viewMode", "club");
              window.location.href = "/";
            }
          }}>
            <RefreshCw className="h-4 w-4 text-indigo-500" />
            <span>Switch</span>
          </div>

          {/* Settings Link */}
          <div className={cn(
            "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer nav-item-rounded",
            location === "/settings" 
              ? "bg-slate-50 text-neutral-900" 
              : "text-neutral-900 hover:bg-slate-50"
          )} onClick={() => window.location.href = "/settings"}>
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Settings</span>
          </div>

          {/* Logout Button */}
          <div className={cn(
            "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer nav-item-rounded",
            "text-neutral-900 hover:bg-red-50"
          )} onClick={handleLogout}>
            <LogOut className="h-4 w-4 text-red-500" />
            <span>Logout</span>
          </div>

          {/* User info */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-neutral-900 truncate">{getUserName()}</p>
            <p className="text-xs text-neutral-500">{isClubMode ? "Admin" : "Contact"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

//Layout component to adjust column widths
export function MainLayout({ children, detailPanel }: { children: React.ReactNode; detailPanel: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr_300px] h-screen"> {/* Adjust grid-cols as needed */}
      <NavigationSidebar />
      <main className="p-4">{children}</main>
      <aside className="p-4 border-l border-neutral-200">{detailPanel}</aside>
    </div>
  );
}