import React, { createContext, useContext, useState, useEffect } from 'react';

import { Sidebar } from './Sidebar';
import type { NavPage } from './Sidebar'; // ⬅ viktigt: samma typ som Sidebar

// Kontext-typ för sidomenyn
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOverlay: boolean;
  setIsMobileOverlay: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Gör hooken typesafe (aldrig undefined när den används rätt)
export const useSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within MainLayout');
  }
  return ctx;
};

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function MainLayout({ children, currentPage, onPageChange }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOverlay, setIsMobileOverlay] = useState(false);

  // Auto-hantering mobil/desktop
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      if (mobile) {
        setIsCollapsed(false);
        setIsMobileOverlay(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const contextValue: SidebarContextType = {
    isCollapsed,
    setIsCollapsed,
    isMobileOverlay,
    setIsMobileOverlay,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="flex h-screen bg-gray-50">
        {/* Mobile overlay */}
        {isMobileOverlay && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsMobileOverlay(false)}
          />
        )}

        <Sidebar currentPage={currentPage} onPageChange={onPageChange} />

        <main
          className={`flex-1 overflow-auto bg-gray-50 transition-all duration-300 
            md:${isCollapsed ? 'ml-16' : 'ml-64'}
            ml-0
          `}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
