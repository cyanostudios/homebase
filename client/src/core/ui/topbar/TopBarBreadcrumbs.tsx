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

export const TopBarBreadcrumbs = React.memo(function TopBarBreadcrumbs({
  activeBreadcrumbLabel,
  detailPanelTitle,
  onGoDashboard,
  onBreadcrumbPrimaryClick,
  onDetailChipClose,
}: {
  activeBreadcrumbLabel: string;
  detailPanelTitle?: string | React.ReactNode;
  onGoDashboard: () => void;
  onBreadcrumbPrimaryClick: () => void;
  onDetailChipClose: (e: React.MouseEvent) => void;
}) {
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-wrap">
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <Button
              variant="link"
              type="button"
              onClick={onGoDashboard}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:no-underline font-normal"
            >
              Homebase
            </Button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:inline-flex" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="flex items-center gap-1 sm:gap-2 min-w-0">
            <BreadcrumbLink asChild>
              <Button
                variant="link"
                type="button"
                onClick={onBreadcrumbPrimaryClick}
                className="h-auto p-0 hover:no-underline truncate text-xs font-medium text-foreground min-w-0"
              >
                {activeBreadcrumbLabel}
              </Button>
            </BreadcrumbLink>
          </BreadcrumbPage>
        </BreadcrumbItem>
        {detailPanelTitle ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="inline-flex items-center gap-1 sm:gap-1.5 min-w-0 px-2 sm:px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                <span className="truncate max-w-[120px] sm:max-w-[220px]">{detailPanelTitle}</span>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={onDetailChipClose}
                  className="h-5 w-5 p-0 hover:bg-primary/20 rounded-sm transition-colors flex-shrink-0"
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
