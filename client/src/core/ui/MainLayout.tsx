import React, { useState, createContext, useContext } from 'react';
import { Sidebar } from './Sidebar';

const SidebarContext = createContext({
  isCollapsed: false,
  setIsCollapsed: (collapsed: boolean) => {}
});

export const useSidebar = () => useContext(SidebarContext);

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="flex h-screen">
        <Sidebar />
        <main className={`flex-1 overflow-auto bg-gray-50 transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        }`}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
