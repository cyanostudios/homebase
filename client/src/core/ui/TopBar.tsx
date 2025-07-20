import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from './MainLayout';

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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const { isMobileOverlay, setIsMobileOverlay } = useSidebar();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

      {/* Right side - Clock only */}
      <div className="flex items-center gap-4">
        {/* Clock */}
        {showClock && (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(currentTime)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}