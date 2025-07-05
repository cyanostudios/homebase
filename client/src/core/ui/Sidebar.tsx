import React from 'react';
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
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { useSidebar } from './MainLayout';

const navCategories = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: Home },
    ]
  },
  {
    title: 'Business',
    items: [
      { label: 'Contacts', icon: Users },
      { label: 'Invoice', icon: FileText },
      { label: 'Journal', icon: BookOpen },
      { label: 'Bookkeeping', icon: Calculator },
      { label: 'Projects', icon: FolderOpen },
    ]
  },
  {
    title: 'Sports',
    items: [
      { label: 'Referee', icon: UserCheck },
      { label: 'Matches', icon: Trophy },
    ]
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', icon: Settings },
      { label: 'Profile', icon: User },
    ]
  }
];

export function Sidebar() {
  const { isCollapsed, setIsCollapsed } = useSidebar();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col z-40 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Logo/Company Name */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!isCollapsed && (
          <span className="text-xl font-bold text-blue-600 tracking-tight">Homebase</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-6 px-2 space-y-6 overflow-y-auto">
        {navCategories.map((category) => (
          <div key={category.title}>
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {category.title}
              </h3>
            )}
            <div className="space-y-1">
              {category.items.map((item) => (
                <a
                  key={item.label}
                  href="#"
                  className={`flex items-center px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium text-sm ${
                    isCollapsed ? 'justify-center' : 'gap-3'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}