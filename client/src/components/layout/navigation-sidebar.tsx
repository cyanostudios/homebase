import { Link, useLocation } from "wouter";
import { useViewMode } from "@/context/view-mode-context";
import {
  Home,
  Users,
  BarChart3,
  Settings,
  LogOut,
  BookOpen, // Represents Invoices or general business documents
  Wallet,   // Represents Payments
  ClipboardList, // Represents Reports
  UserCog, // Represents Staff List/Accounts
  LifeBuoy, // Represents Customer Support
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

function NavItem({ href, icon, label, isActive }: NavItemProps) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-md mx-2",
        isActive
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-neutral-700 hover:bg-neutral-100"
      )}>
        <span className={isActive ? "text-white" : "text-neutral-500"}>{icon}</span>
        <span>{label}</span>
      </div>
    </Link>
  );
}

interface NavSectionProps {
  title: string;
  items: { href: string; icon: React.ReactNode; label: string; }[];
}

function NavSection({ title, items }: NavSectionProps) {
  const [location] = useLocation();
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase text-neutral-400 tracking-wider px-4 py-2 mt-4 mb-1">
        {title}
      </h3>
      {items.map((item) => (
        <NavItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
          isActive={location === item.href}
        />
      ))}
    </div>
  );
}

export function NavigationSidebar() {
  const { viewMode } = useViewMode();
  const isClubMode = viewMode === "club";

  const navigationGroups = [
    {
      title: "MAIN",
      items: [
        { href: "/", icon: <Home className="h-4 w-4" />, label: "Dashboard" },
        { href: "/contacts", icon: <Users className="h-4 w-4" />, label: "Contacts" },
      ],
    },
    {
      title: "BUSINESS",
      items: [
        { href: "/invoices", icon: <BookOpen className="h-4 w-4" />, label: "Invoices" },
        { href: "/payments", icon: <Wallet className="h-4 w-4" />, label: "Payments" }, // Placeholder
        { href: "/stats", icon: <ClipboardList className="h-4 w-4" />, label: "Reports" }, // Using stats for Reports
      ],
    },
    {
      title: "SETTINGS",
      items: [
        { href: "/settings", icon: <Settings className="h-4 w-4" />, label: "Settings" },
        { href: "/staff-list", icon: <UserCog className="h-4 w-4" />, label: "Staff List" }, // Placeholder
        { href: "/accounts", icon: <Users className="h-4 w-4" />, label: "Accounts" }, // Placeholder
        { href: "/support", icon: <LifeBuoy className="h-4 w-4" />, label: "Customer Support" }, // Placeholder
      ],
    },
  ];

  const handleLogout = () => {
    if (!isClubMode) {
      localStorage.removeItem("contactId");
      localStorage.removeItem("contactName");
      localStorage.setItem("viewMode", "club");
      window.location.href = "/";
    }
  };

  return (
    <div className="w-[260px] flex-shrink-0 h-full flex flex-col bg-white border-r border-neutral-200 shadow-sm">
      <div className="flex-1 py-4">
        <nav className="space-y-1">
          {navigationGroups.map((group) => (
            <NavSection key={group.title} title={group.title} items={group.items} />
          ))}
        </nav>
      </div>

      {/* Logout Button */}
      <div className="border-t border-neutral-200 py-4">
        <div className={cn(
          "flex items-center space-x-3 px-5 py-2 text-sm font-medium transition-colors cursor-pointer rounded-md mx-2",
          "text-neutral-700 hover:bg-red-50 hover:text-red-700"
        )} onClick={handleLogout}>
          <LogOut className="h-4 w-4 text-neutral-500" />
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
}

// MainLayout component (no changes to be made here, just ensuring it's present for context)
export function MainLayout({ children, detailPanel }: { children: React.ReactNode; detailPanel: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[260px_1fr_672px] h-screen"> {/* Adjust grid-cols as needed */}
      <NavigationSidebar />
      <main className="p-4">{children}</main>
      <aside className="p-4 border-l border-neutral-200">{detailPanel}</aside>
    </div>
  );
}