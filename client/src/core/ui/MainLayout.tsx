import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOverlay: boolean;
  setIsMobileOverlay: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => useContext(SidebarContext);

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: 'contacts' | 'notes' | 'estimates' | 'tasks' | 'import';
  onPageChange: (page: 'contacts' | 'notes' | 'estimates' | 'tasks' | 'import') => void;
}

export function MainLayout({ children, currentPage, onPageChange }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOverlay, setIsMobileOverlay] = useState(false);

  // Auto-collapse on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !isCollapsed) {
        setIsCollapsed(false);
        setIsMobileOverlay(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

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
        <main className={`flex-1 overflow-auto bg-gray-50 transition-all duration-300 
          md:${isCollapsed ? 'ml-16' : 'ml-64'}
          ml-0
        `}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}