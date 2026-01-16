import React from 'react';

import { SidebarProvider } from '@/components/ui/sidebar';

import { DetailPanel } from './DetailPanel';
import { Sidebar } from './Sidebar';
import type { NavPage } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  // DetailPanel props
  detailPanelOpen: boolean;
  detailPanelTitle: string;
  detailPanelSubtitle?: string | React.ReactNode;
  detailPanelContent: React.ReactNode;
  detailPanelFooter?: React.ReactNode;
  onDetailPanelClose: () => void;
}

export function MainLayout({
  children,
  currentPage,
  onPageChange,
  detailPanelOpen,
  detailPanelTitle,
  detailPanelSubtitle,
  detailPanelContent,
  detailPanelFooter,
  onDetailPanelClose,
}: MainLayoutProps) {
  return (
    <SidebarProvider>
      {/* Kolumn 1: Nav - Sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={onPageChange} />
      {/* Kolumn 2: List Area - tar hela återstående utrymmet, egen scroll */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden h-full border-r border-border">
        {children}
      </div>
      {/* Kolumn 3: Detail Panel - fast 600px bredd, alltid synlig */}
      <DetailPanel
        isOpen={detailPanelOpen}
        onClose={onDetailPanelClose}
        title={detailPanelTitle}
        subtitle={detailPanelSubtitle}
        footer={detailPanelFooter}
      >
        {detailPanelContent}
      </DetailPanel>
    </SidebarProvider>
  );
}
