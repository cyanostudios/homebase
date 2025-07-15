import React, { useState, useEffect } from 'react';
import { Clock, Menu, LogOut, User } from 'lucide-react';
import { useSidebar } from './MainLayout';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';

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
  const { isCollapsed, setIsCollapsed, isMobileOverlay, setIsMobileOverlay } = useSidebar();
  const { user, logout } = useApp();

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

  const handleLogout = async () => {
    await logout();
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

      {/* Center/Right side - User info, Clock, Logout */}
      <div className="flex items-center gap-4">
        {/* User info - hidden on mobile if clock is shown */}
        {user && (
          <div className={`flex items-center gap-2 text-sm text-gray-600 ${showClock && isMobile ? 'hidden' : ''}`}>
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{user.email}</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {user.role}
            </span>
          </div>
        )}

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

        {/* Logout button */}
        {user && (
          <Button
            onClick={handleLogout}
            variant="secondary"
            icon={LogOut}
            className="text-sm"
          >
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Out</span>
          </Button>
        )}
      </div>
    </div>
  );
}