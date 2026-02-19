import { LucideIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { ContentHeader } from './ContentHeader';
import { ContentLayoutProvider } from './ContentLayoutContext';
import { ContentSurface } from './ContentSurface';
import { DetailPanel } from './DetailPanel';
import { Sidebar } from './Sidebar';
import type { NavPage } from './Sidebar';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  contentTitle: string;
  contentIcon?: LucideIcon;
  contentActionLabel?: string;
  contentActionIcon?: LucideIcon;
  onContentAction?: () => void;
  // DetailPanel props
  detailPanelOpen: boolean;
  detailPanelTitle: string;
  detailPanelSubtitle?: string | React.ReactNode;
  detailPanelContent: React.ReactNode;
  detailPanelFooter?: React.ReactNode;
  detailPanelHeaderRight?: React.ReactNode;
  onDetailPanelClose: () => void;
  detailPanelPluginName?: string;
}

export function MainLayout({
  children,
  currentPage,
  onPageChange,
  contentTitle,
  contentIcon,
  contentActionLabel,
  contentActionIcon,
  onContentAction,
  detailPanelOpen,
  detailPanelTitle,
  detailPanelSubtitle,
  detailPanelContent,
  detailPanelFooter,
  detailPanelHeaderRight,
  onDetailPanelClose,
  detailPanelPluginName,
}: MainLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<React.ReactNode>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Clear trailing when page changes
  useEffect(() => {
    setHeaderTrailing(null);
  }, [currentPage]);

  // Navigation (including close behavior) is handled upstream in App.tsx.
  const handlePageChange = (page: NavPage) => {
    onPageChange(page);
  };

  return (
    <div className="min-h-screen bg-muted">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <TopBar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        detailPanelTitle={detailPanelOpen ? detailPanelTitle : undefined}
        onDetailPanelClose={detailPanelOpen ? onDetailPanelClose : undefined}
        detailPanelPluginName={detailPanelOpen ? detailPanelPluginName : undefined}
      />

      <main className="flex h-[calc(100vh-3.5rem)] pt-14 md:pl-[252px] md:pr-4">
        {/* Mobile: Show DetailPanel as overlay, hide list view when open */}
        {/* Desktop: Show DetailPanel as column alongside list view */}
        {isMobile ? (
          <>
            {/* Mobile: Always show list view when DetailPanel is closed */}
            {!detailPanelOpen && (
              <ContentSurface>
                <ContentLayoutProvider onTrailingChange={setHeaderTrailing}>
                  <div className="flex h-full flex-col gap-4">
                    <ContentHeader
                      title={contentTitle}
                      icon={contentIcon}
                      actionLabel={contentActionLabel}
                      actionIcon={contentActionIcon}
                      onAction={onContentAction}
                      trailing={headerTrailing}
                    />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
                    </div>
                  </div>
                </ContentLayoutProvider>
              </ContentSurface>
            )}
            {/* Mobile: DetailPanel as Sheet overlay */}
            <DetailPanel
              isOpen={detailPanelOpen}
              onClose={onDetailPanelClose}
              title={detailPanelTitle}
              subtitle={detailPanelSubtitle}
              footer={detailPanelFooter}
              headerRight={detailPanelHeaderRight}
              isMobile={isMobile}
            >
              {detailPanelContent}
            </DetailPanel>
          </>
        ) : (
          <>
            {/* Desktop: Show DetailPanel as column when open, otherwise show list view */}
            {detailPanelOpen ? (
              <ContentSurface>
                <DetailPanel
                  isOpen={detailPanelOpen}
                  onClose={onDetailPanelClose}
                  title={detailPanelTitle}
                  subtitle={detailPanelSubtitle}
                  footer={detailPanelFooter}
                  headerRight={detailPanelHeaderRight}
                  isMobile={isMobile}
                >
                  {detailPanelContent}
                </DetailPanel>
              </ContentSurface>
            ) : (
              <ContentSurface>
                <ContentLayoutProvider onTrailingChange={setHeaderTrailing}>
                  <div className="flex h-full flex-col gap-4">
                    <ContentHeader
                      title={contentTitle}
                      icon={contentIcon}
                      actionLabel={contentActionLabel}
                      actionIcon={contentActionIcon}
                      onAction={onContentAction}
                      trailing={headerTrailing}
                    />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
                    </div>
                  </div>
                </ContentLayoutProvider>
              </ContentSurface>
            )}
          </>
        )}
      </main>
    </div>
  );
}
