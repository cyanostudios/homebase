import type { AppIcon } from '@/types/icons';
import React, { useState, useEffect, useCallback } from 'react';

import { useViewportTier } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { AppRightSidebar } from './AppRightSidebar';
import { CompanionPanel } from './CompanionPanel';
import { ContentHeader } from './ContentHeader';
import { ContentLayoutProvider } from './ContentLayoutContext';
import { ContentSurface, MAIN_CONTENT_SHELL_CLASS } from './ContentSurface';
import { DetailPanel } from './DetailPanel';
import { MobileActionsProvider, useMobileSearchBar } from './MobileActionsContext';
import { MobileBottomBar } from './MobileBottomBar';
import { RightSidebarProvider } from './RightSidebarContext';
import { Sidebar } from './Sidebar';
import type { NavPage } from '@/core/navigation/navTypes';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  contentTitle: string;
  contentIcon?: AppIcon;
  contentActionLabel?: string;
  contentActionIcon?: AppIcon;
  contentActionVariant?: 'primary' | 'secondary';
  onContentAction?: () => void;
  // DetailPanel props
  detailPanelOpen: boolean;
  detailPanelTitle: string | React.ReactNode;
  /** String label for TopBar breadcrumb chip (never React action bars). */
  detailPanelBreadcrumbLabel?: string;
  detailPanelSubtitle?: string | React.ReactNode;
  detailPanelContent: React.ReactNode;
  detailPanelFooter?: React.ReactNode;
  detailPanelHeaderRight?: React.ReactNode;
  detailPanelShowCloseButton?: boolean;
  onDetailPanelClose: () => void;
  detailPanelPluginName?: string;
  /** Resets detail scroll when plugin/mode/item changes. */
  detailPanelContentKey?: string;
  /** When true, list ContentSurface uses p-0 (like detail panel) so the plugin controls its own padding. */
  contentFlush?: boolean;
  /** Desktop Companion Panel (secondary plugin list beside primary). */
  companionPanelOpen?: boolean;
  companionPanelTitle?: string;
  companionPanelContent?: React.ReactNode;
  onCompanionPanelClose?: () => void;
}

function MainLayoutShell(props: MainLayoutProps) {
  const {
    children,
    currentPage,
    onPageChange,
    contentTitle,
    contentIcon,
    contentActionLabel,
    contentActionIcon,
    contentActionVariant,
    onContentAction,
    detailPanelOpen,
    detailPanelTitle,
    detailPanelBreadcrumbLabel,
    detailPanelSubtitle,
    detailPanelContent,
    detailPanelFooter,
    detailPanelHeaderRight,
    detailPanelShowCloseButton = true,
    onDetailPanelClose,
    detailPanelPluginName,
    detailPanelContentKey,
    contentFlush = false,
    companionPanelOpen = false,
    companionPanelTitle = '',
    companionPanelContent,
    onCompanionPanelClose,
  } = props;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<React.ReactNode>(null);
  const [headerTitleSuffix, setHeaderTitleSuffix] = useState<React.ReactNode>(null);
  const viewportTier = useViewportTier();
  const isPhone = viewportTier === 'phone';
  const isPad = viewportTier === 'pad';
  const { searchOpen } = useMobileSearchBar();

  useEffect(() => {
    setHeaderTrailing(null);
    setHeaderTitleSuffix(null);
  }, [currentPage]);

  const handlePageChange = useCallback(
    (page: NavPage) => {
      onPageChange(page);
    },
    [onPageChange],
  );

  const openMobileNav = useCallback(() => {
    setMobileNavOpen(true);
  }, []);
  const shouldShowContentHeader = Boolean(
    contentTitle || contentIcon || headerTitleSuffix || contentActionLabel || headerTrailing,
  );

  const mobileListScrollPad =
    isPhone && !detailPanelOpen ? (searchOpen ? 'pb-36' : 'pb-20') : undefined;

  const listBody = (
    <ContentLayoutProvider
      onTrailingChange={setHeaderTrailing}
      onTitleSuffixChange={setHeaderTitleSuffix}
    >
      {contentFlush && !shouldShowContentHeader ? (
        <div className={cn('min-h-0 flex-1 overflow-y-auto', mobileListScrollPad)}>{children}</div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          {shouldShowContentHeader && (
            <ContentHeader
              title={contentTitle}
              icon={contentIcon}
              titleSuffix={headerTitleSuffix}
              actionLabel={contentActionLabel}
              actionIcon={contentActionIcon}
              actionVariant={contentActionVariant}
              onAction={onContentAction}
              trailing={headerTrailing}
            />
          )}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto', mobileListScrollPad)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </ContentLayoutProvider>
  );

  const listSurface = (
    <ContentSurface
      flush={contentFlush}
      className={isPad && detailPanelOpen ? 'w-full' : undefined}
    >
      <div className={MAIN_CONTENT_SHELL_CLASS}>{listBody}</div>
    </ContentSurface>
  );

  const detailInline = (
    <DetailPanel
      isOpen={detailPanelOpen}
      onClose={onDetailPanelClose}
      title={detailPanelTitle}
      subtitle={detailPanelSubtitle}
      footer={detailPanelFooter}
      headerRight={detailPanelHeaderRight}
      showCloseButton={detailPanelShowCloseButton}
      contentKey={detailPanelContentKey}
      isMobile={false}
    >
      <React.Fragment key={detailPanelContentKey ?? 'detail'}>{detailPanelContent}</React.Fragment>
    </DetailPanel>
  );

  const primarySurface = detailPanelOpen ? (
    <ContentSurface flush>{detailInline}</ContentSurface>
  ) : (
    listSurface
  );

  const showCompanion = !isPhone && !isPad && companionPanelOpen;

  const desktopMain = showCompanion ? (
    <div className="flex min-h-0 w-full flex-1 gap-4">
      <div className="min-h-0 min-w-0 flex-1">{primarySurface}</div>
      <CompanionPanel
        isOpen
        title={companionPanelTitle}
        onClose={onCompanionPanelClose ?? (() => undefined)}
        closeOnEscape={!detailPanelOpen}
      >
        {companionPanelContent}
      </CompanionPanel>
    </div>
  ) : (
    primarySurface
  );

  return (
    <div className="flex h-dvh flex-col bg-workspace">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <TopBar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onOpenMobileNav={openMobileNav}
        detailPanelTitle={
          detailPanelOpen
            ? (detailPanelBreadcrumbLabel ??
              (typeof detailPanelTitle === 'string' ? detailPanelTitle : undefined))
            : undefined
        }
        onDetailPanelClose={detailPanelOpen ? onDetailPanelClose : undefined}
        detailPanelPluginName={detailPanelOpen ? detailPanelPluginName : undefined}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden lg:pl-[252px]">
        <main
          className={cn(
            'flex min-h-0 min-w-0 flex-1 overflow-hidden bg-workspace',
            !isPhone && 'pr-4',
          )}
        >
          {isPhone ? (
            detailPanelOpen ? (
              <ContentSurface flush className="flex min-h-0 w-full flex-1 flex-col">
                <DetailPanel
                  isOpen={detailPanelOpen}
                  onClose={onDetailPanelClose}
                  title={detailPanelTitle}
                  subtitle={detailPanelSubtitle}
                  footer={detailPanelFooter}
                  headerRight={detailPanelHeaderRight}
                  showCloseButton={detailPanelShowCloseButton}
                  contentKey={detailPanelContentKey}
                  isMobile
                >
                  <React.Fragment key={detailPanelContentKey ?? 'detail'}>
                    {detailPanelContent}
                  </React.Fragment>
                </DetailPanel>
              </ContentSurface>
            ) : (
              listSurface
            )
          ) : isPad ? (
            <div
              className={cn(
                'flex min-h-0 w-full flex-1',
                detailPanelOpen ? 'flex-row gap-4' : undefined,
              )}
            >
              <div
                className={cn(
                  'min-h-0 min-w-0',
                  detailPanelOpen ? 'w-[38%] min-w-[280px] max-w-[42%] flex-none' : 'w-full flex-1',
                )}
              >
                {listSurface}
              </div>
              {detailPanelOpen ? (
                <div className="min-h-0 min-w-0 flex-1">
                  <ContentSurface flush>{detailInline}</ContentSurface>
                </div>
              ) : null}
            </div>
          ) : (
            desktopMain
          )}
        </main>

        <AppRightSidebar />
      </div>

      <MobileBottomBar detailPanelOpen={detailPanelOpen} />
    </div>
  );
}

export function MainLayout(props: MainLayoutProps) {
  return (
    <RightSidebarProvider>
      <MobileActionsProvider>
        <MainLayoutShell {...props} />
      </MobileActionsProvider>
    </RightSidebarProvider>
  );
}
