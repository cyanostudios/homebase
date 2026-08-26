import { X } from 'lucide-react';
import React from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const TopBarBreadcrumbs = React.memo(function TopBarBreadcrumbs({
  brandLabel = 'Homebase',
  activeBreadcrumbLabel,
  detailPanelTitle,
  onGoDashboard,
  onBreadcrumbPrimaryClick,
  onDetailChipClose,
}: {
  brandLabel?: string;
  activeBreadcrumbLabel: string;
  detailPanelTitle?: string | React.ReactNode;
  onGoDashboard: () => void;
  onBreadcrumbPrimaryClick: () => void;
  onDetailChipClose: (e: React.MouseEvent) => void;
}) {
  const hasDetail = Boolean(detailPanelTitle);

  return (
    <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
      <BreadcrumbList className="flex-nowrap items-center gap-1 overflow-hidden sm:gap-1.5">
        <BreadcrumbItem className="hidden sm:inline-flex shrink-0">
          <BreadcrumbLink asChild>
            <Button
              variant="link"
              type="button"
              onClick={onGoDashboard}
              className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:no-underline"
            >
              {brandLabel}
            </Button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden shrink-0 sm:inline-flex" />
        <BreadcrumbItem
          className={cn('min-w-0', hasDetail ? 'hidden max-w-[30%] sm:inline-flex' : 'max-w-full')}
        >
          <BreadcrumbPage className="flex min-w-0 items-center gap-1 sm:gap-2">
            <BreadcrumbLink asChild>
              <Button
                variant="link"
                type="button"
                onClick={onBreadcrumbPrimaryClick}
                className="h-auto min-w-0 truncate p-0 text-sm font-semibold text-foreground hover:no-underline sm:text-xs sm:font-medium"
              >
                {activeBreadcrumbLabel}
              </Button>
            </BreadcrumbLink>
          </BreadcrumbPage>
        </BreadcrumbItem>
        {hasDetail ? (
          <>
            <BreadcrumbSeparator className="hidden shrink-0 sm:inline-flex" />
            <BreadcrumbItem className="min-w-0 max-w-full flex-1 sm:max-w-[min(100%,16rem)]">
              <BreadcrumbPage className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-extrabold text-primary sm:gap-1.5 sm:px-2.5">
                <span className="min-w-0 flex-1 truncate">{detailPanelTitle}</span>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={onDetailChipClose}
                  className="h-5 w-5 flex-shrink-0 rounded-sm p-0 transition-colors hover:bg-primary/20"
                  aria-label="Close detail panel"
                >
                  <X className="h-3 w-3" />
                </Button>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
});
