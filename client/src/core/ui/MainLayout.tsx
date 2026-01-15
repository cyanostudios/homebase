import React from 'react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { Sidebar } from './Sidebar';
import type { NavPage } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function MainLayout({ children, currentPage, onPageChange }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <Sidebar currentPage={currentPage} onPageChange={onPageChange} />
      <SidebarInset>
        <div className="flex-1 overflow-auto bg-background">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
