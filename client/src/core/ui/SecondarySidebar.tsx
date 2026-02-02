import { ChevronLeft } from 'lucide-react';
import React from 'react';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

import type { NavPage } from './Sidebar';

interface SecondarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    page: NavPage;
    order: number;
  }>;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function SecondarySidebar({
  isOpen,
  onClose,
  title,
  items,
  currentPage,
  onPageChange,
}: SecondarySidebarProps) {
  const handleItemClick = (page: NavPage) => {
    onPageChange(page);
    onClose();
  };

  return (
    <div
      className={cn(
        'relative flex h-full flex-col bg-sidebar text-sidebar-foreground border-l transition-all duration-300 ease-in-out',
        isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden border-0',
      )}
    >
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="Close submenu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {title && <span className="text-lg font-semibold">{title}</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {items
            .sort((a, b) => a.order - b.order)
            .map((item) => {
              const isActive = item.page === currentPage;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton onClick={() => handleItemClick(item.page)} isActive={isActive}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarContent>
    </div>
  );
}
