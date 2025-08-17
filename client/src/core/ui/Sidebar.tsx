import React, { useEffect, useState } from 'react';
import { 
  Home, 
  FileText, 
  BookOpen, 
  Calculator, 
  Users, 
  FolderOpen, 
  Settings, 
  User,
  UserCheck,
  Trophy,
  Calendar,
  Package,
  StickyNote,
  CheckSquare,
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Train
} from 'lucide-react';
import { useSidebar } from './MainLayout';
import { useApp } from '@/core/api/AppContext';

// Added 'products', removed 'import'
type NavPage = 'contacts' | 'notes' | 'estimates' | 'tasks' | 'products' | 'rails';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

// Added "Products" under Business, removed "Import" under Tools
const navCategories = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: Home, page: null },
      { label: 'Contacts', icon: Users, page: 'contacts' as NavPage },
      { label: 'Notes', icon: StickyNote, page: 'notes' as NavPage },
      { label: 'Tasks', icon: CheckSquare, page: 'tasks' as NavPage },
      { label: 'Calendar', icon: Calendar, page: null },
      { label: 'Planner', icon: Calendar, page: null },
    ]
  },
  {
    title: 'Business',
    items: [
      { label: 'Products', icon: Package, page: 'products' as NavPage }, // new
      { label: 'Estimates', icon: Calculator, page: 'estimates' as NavPage },
      { label: 'Invoice', icon: FileText, page: null },
      { label: 'Journal', icon: BookOpen, page: null },
      { label: 'Bookkeeping', icon: Calculator, page: null },
      { label: 'Projects', icon: FolderOpen, page: null },
      { label: 'Equipment', icon: Package, page: null },
    ]
  },
  {
    title: 'Tools',
    items: [
      { label: 'Rail', icon: Train, page: 'rails' as NavPage }, // removed Import
    ]
  },
  {
    title: 'Sports',
    items: [
      { label: 'Referee', icon: UserCheck, page: null },
      { label: 'Matches', icon: Trophy, page: null },
    ]
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', icon: Settings, page: null },
      { label: 'Profile', icon: User, page: null },
    ]
  }
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { isCollapsed, setIsCollapsed, isMobileOverlay, setIsMobileOverlay } = useSidebar();
  const { logout, user } = useApp();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  // Updated to include 'products' and remove 'import'
  const handleMenuItemClick = (page: NavPage | null) => {
    if (isMobile && isMobileOverlay) setIsMobileOverlay(false);
    if (page === 'contacts' || page === 'notes' || page === 'estimates' || page === 'tasks' || page === 'products' || page === 'rails') {
      onPageChange(page);
    }
  };

  return (
    <aside className={`left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-40
      ${isMobile ? 'fixed' : 'sticky'}
      ${isMobile ? (
        isMobileOverlay ? 'translate-x-0 w-64' : '-translate-x-full w-64'
      ) : (
        isCollapsed ? 'w-16' : 'w-64'
      )}
    `}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {(!isCollapsed || (isMobile && isMobileOverlay)) && (
          <span className="text-xl font-bold text-blue-600 tracking-tight">Homebase</span>
        )}
        <button
          onClick={() => {
            if (isMobile) {
              setIsMobileOverlay(!isMobileOverlay);
            } else {
              setIsCollapsed(!isCollapsed);
            }
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {(isCollapsed && !isMobileOverlay) ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 py-6 px-2 space-y-6 overflow-y-auto">
        {navCategories.map((category) => (
          <div key={category.title}>
            {(!isCollapsed || (isMobile && isMobileOverlay)) && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {category.title}
              </h3>
            )}
            <div className="space-y-1">
              {category.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleMenuItemClick(item.page)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                    (isCollapsed && !(isMobile && isMobileOverlay)) ? 'justify-center' : 'gap-3'
                  } ${
                    item.page === currentPage 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  } ${
                    item.page === null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title={(isCollapsed && !(isMobile && isMobileOverlay)) ? item.label : undefined}
                  disabled={item.page === null}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {(!isCollapsed || (isMobile && isMobileOverlay)) && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User info and Logout at bottom */}
      <div className="border-t border-gray-200">
        {/* User info */}
        {user && (!isCollapsed || (isMobile && isMobileOverlay)) && (
          <div className="p-2">
            <div className="flex items-center px-3 py-2 gap-3">
              <User className="h-5 w-5 text-gray-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate text-sm">{user.email}</div>
                <div className="text-xs text-gray-500 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Logout button */}
        <div className="p-2">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors font-medium text-sm text-red-600 hover:bg-red-50 ${
              (isCollapsed && !(isMobile && isMobileOverlay)) ? 'justify-center' : 'gap-3'
            }`}
            title={(isCollapsed && !(isMobile && isMobileOverlay)) ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {(!isCollapsed || (isMobile && isMobileOverlay)) && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
