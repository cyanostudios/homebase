import { Menu, ChevronDown } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useApp } from '@/core/api/AppContext';
import { ClockDisplay } from './clock/ClockDisplay';
import { useSidebar } from './MainLayout';
import { PomodoroTimer } from './pomodoro/PomodoroTimer';

interface TopBarProps {
  height?: number;
  showClock?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface Tenant {
  id: number;
  email: string;
  role: string;
  neon_database_name: string;
  neon_connection_string: string;
}

export function TopBar({ height = 64, showClock = true, className = '', children }: TopBarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [openPanel, setOpenPanel] = useState<'pomodoro' | 'clock' | null>(null);
  const { isMobileOverlay, setIsMobileOverlay } = useSidebar();
  const { user, refreshData } = useApp();

  // Admin tenant switching state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantUserId, setCurrentTenantUserId] = useState<number | null>(null);
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);

  const isAdmin = user?.role === 'superuser';

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load tenants for admin
  useEffect(() => {
    if (isAdmin) {
      loadTenants();
    }
  }, [isAdmin]);

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const response = await fetch('/api/admin/tenants', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Filter: Only show tenants with active Neon databases
        const activeTenants = data.tenants.filter(
          (tenant: Tenant) => tenant.neon_connection_string !== null
        );
        
        setTenants(activeTenants);
        
        // Set current tenant to logged-in user by default
        if (user && !currentTenantUserId) {
          setCurrentTenantUserId(user.id);
        }
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setIsLoadingTenants(false);
    }
  };
  
  const switchTenant = async (userId: number) => {
    try {
      const response = await fetch('/api/admin/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setCurrentTenantUserId(userId);
        setShowTenantDropdown(false);
        
        // Refresh all data with new tenant context
        await refreshData();
        
        console.log(`✅ Switched to tenant: User ${userId}`);
      } else {
        console.error('Failed to switch tenant');
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  };

  const handlePanelToggle = (panel: 'pomodoro' | 'clock') => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  // Get current tenant display name
  const getCurrentTenantDisplay = () => {
    if (!currentTenantUserId) return user?.email || 'Unknown';
    
    const tenant = tenants.find(t => t.id === currentTenantUserId);
    return tenant?.email || user?.email || 'Unknown';
  };

  return (
    <div
      className={`w-full bg-white border-b border-gray-200 flex items-center justify-between px-6 ${className}`}
      style={{ height: `${height}px` }}
    >
      {/* Left side - Mobile menu + Admin Tenant Dropdown */}
      <div className="flex items-center gap-4">
        {isMobile && (
          <button
            onClick={() => setIsMobileOverlay(!isMobileOverlay)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        )}
        
        {/* Admin Tenant Dropdown */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowTenantDropdown(!showTenantDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="text-sm font-medium text-blue-900">
                {getCurrentTenantDisplay()}
              </span>
              <ChevronDown className="w-4 h-4 text-blue-700" />
            </button>

            {showTenantDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTenantDropdown(false)}
                />
                
                {/* Dropdown */}
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 px-3 py-2">
                      Switch Tenant View
                    </div>
                    
                    {isLoadingTenants ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        Loading tenants...
                      </div>
                    ) : tenants.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No tenants found
                      </div>
                    ) : (
                      tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => switchTenant(tenant.id)}
                          className={`w-full px-3 py-2 text-left rounded-md transition-colors ${
                            currentTenantUserId === tenant.id
                              ? 'bg-blue-100 text-blue-900'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="text-sm font-medium">{tenant.email}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ID: {tenant.id} • {tenant.role}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
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