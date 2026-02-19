import React, { useState } from 'react';

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
  contentIcon?: React.ComponentType<{ className?: string }>;
  contentActionLabel?: string;
  contentActionIcon?: React.ComponentType<{ className?: string }>;
  onContentAction?: () => void;
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
  onDetailPanelClose,
}: MainLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<React.ReactNode>(null);

  // Navigation: only trigger App's handlePageChange (guard + close panel handled there)
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
      />

      <main className="flex h-[calc(100vh-3.5rem)] pt-14 md:pl-[252px] md:pr-4">
        {detailPanelOpen ? (
          <ContentSurface>
            <DetailPanel
              isOpen={detailPanelOpen}
              onClose={onDetailPanelClose}
              title={detailPanelTitle}
              subtitle={detailPanelSubtitle}
              footer={detailPanelFooter}
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
      </main>
    </div>
  );
}
