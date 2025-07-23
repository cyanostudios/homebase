import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from './MainLayout';
import { PomodoroTimer } from './pomodoro/PomodoroTimer';
import { ClockDisplay } from './clock/ClockDisplay';

interface TopBarProps {
  height?: number;
  showClock?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function TopBar({
  height = 64,
  showClock = true,
  className = '',
  children
}: TopBarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [openPanel, setOpenPanel] = useState<'pomodoro' | 'clock' | null>(null);
  const { isMobileOverlay, setIsMobileOverlay } = useSidebar();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handlePanelToggle = (panel: 'pomodoro' | 'clock') => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  return (
    <div 
      className={`w-full bg-white border-b border-gray-200 flex items-center justify-between px-6 ${className}`}
      style={{ height: `${height}px` }}
    >
      {/* Left side - Mobile menu + future content */}
      <div className="flex items-center gap-4">
        {isMobile && (
          <button
            onClick={() => setIsMobileOverlay(!isMobileOverlay)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        )}
        {children}
      </div>

      {/* Right side - Pomodoro Timer + Clock */}
      <div className="flex items-center gap-4 relative">
        {/* Pomodoro Timer */}
        <PomodoroTimer 
          compact={true} 
          isExpanded={openPanel === 'pomodoro'}
          onToggle={() => handlePanelToggle('pomodoro')}
          onClose={handleClosePanel}
        />
        
        {/* Clock */}
        {showClock && (
          <ClockDisplay 
            compact={true}
            isExpanded={openPanel === 'clock'}
            onToggle={() => handlePanelToggle('clock')}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  );
}