import React, { useState, createContext, useContext, useEffect } from 'react';
import { Sidebar } from './Sidebar';

const SidebarContext = createContext({
  isCollapsed: false,
  setIsCollapsed: (collapsed: boolean) => {},
  isMobileOverlay: false,
  setIsMobileOverlay: (overlay: boolean) => {}
});

export const useSidebar = () => useContext(SidebarContext);

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOverlay, setIsMobileOverlay] = useState(false);

  // Auto-collapse on mobile
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile && !isCollapsed) {
        setIsCollapsed(true);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isMobileOverlay, setIsMobileOverlay }}>
      <div className="flex h-screen">
        {/* Mobile Backdrop */}
        {isMobileOverlay && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsMobileOverlay(false)}
          />
        )}
        
        <Sidebar />
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