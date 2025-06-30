import { useLocation } from "wouter";
import { Home, Calendar, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const tabs: TabItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: Trophy,
    path: "/invoices",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    path: "/calendar",
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: Users,
    path: "/contacts",
  },
];

export function MobileBottomTabs() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => setLocation(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors min-w-0 flex-1",
                active
                  ? "text-primary bg-primary/10"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}