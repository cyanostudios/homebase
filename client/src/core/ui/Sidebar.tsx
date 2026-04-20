import { ChevronDown, ChevronRight, Home, type LucideIcon } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { categoryOrder } from '@/core/navigationConfig';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type NavPage =
  | 'dashboard'
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'invoices'
  | 'invoices-recurring'
  | 'invoices-payments'
  | 'invoices-reports'
  | 'tasks'
  | 'matches'
  | 'slots'
  | 'cups'
  | 'files'
  | 'ingest'
  | 'mail'
  | 'pulses'
  | 'settings';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

type SubmenuNavItem = {
  label: string;
  icon: LucideIcon;
  page: NavPage;
  order: number;
};

type NavItemData = {
  label: string;
  icon: LucideIcon;
  page: NavPage;
  order: number;
  badge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  submenu?: SubmenuNavItem[];
};

type NavCategory = {
  title: string;
  items: NavItemData[];
};

const NavSubItem = React.memo(function NavSubItem({
  item,
  isActive,
  onNavigate,
}: {
  item: SubmenuNavItem;
  isActive: boolean;
  onNavigate: (page: NavPage) => void;
}) {
  const SubIcon = item.icon;
  const handleClick = useCallback(() => {
    onNavigate(item.page);
  }, [onNavigate, item.page]);

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={handleClick}
      className={cn(
        'group w-full flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors justify-start h-auto',
        isActive
          ? 'bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:text-primary'
          : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary',
      )}
    >
      <SubIcon
        className={cn(
          'h-4 w-4 flex-shrink-0 transition-colors',
          isActive
            ? 'text-primary/70 group-hover:text-primary/70'
            : 'text-slate-400 dark:text-slate-500 group-hover:text-primary/70',
        )}
      />
      <span className={cn('truncate', isActive ? 'font-medium' : '')}>{item.label}</span>
    </Button>
  );
});

const NavItem = React.memo(function NavItem({
  item,
  isActive,
  activeSubPage,
  isSubmenuOpen,
  onNavigate,
  onToggleSubmenu,
}: {
  item: NavItemData;
  isActive: boolean;
  /** Om aktuell route är en underrad under detta item, annars null */
  activeSubPage: NavPage | null;
  isSubmenuOpen: boolean;
  onNavigate: (page: NavPage) => void;
  onToggleSubmenu: (itemLabel: string) => void;
}) {
  const Icon = item.icon;
  const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);

  const handleNavigateTop = useCallback(() => {
    onNavigate(item.page);
  }, [onNavigate, item.page]);

  const handleToggle = useCallback(() => {
    onToggleSubmenu(item.label);
  }, [onToggleSubmenu, item.label]);

  const buttonClass = cn(
    'group w-full flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors',
    'justify-start',
    isActive
      ? 'bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:text-primary'
      : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary',
  );

  const content = (
    <>
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0 transition-colors',
          isActive
            ? 'text-primary/70 group-hover:text-primary/70'
            : 'text-slate-400 dark:text-slate-500 group-hover:text-primary/70',
        )}
      />
      <span className={cn('truncate', isActive ? 'font-medium' : '')}>{item.label}</span>
      {item.badge && (
        <Badge variant={item.badge.variant} className="ml-auto">
          {item.badge.label}
        </Badge>
      )}
      {hasSubmenu &&
        (isSubmenuOpen ? (
          <ChevronDown className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
        ) : (
          <ChevronRight className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
        ))}
    </>
  );

  if (hasSubmenu && item.submenu) {
    return (
      <Collapsible open={isSubmenuOpen} onOpenChange={handleToggle} className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" type="button" className={cn(buttonClass, 'h-auto')}>
            {content}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-6 pt-1 pb-1 space-y-1">
            {item.submenu.map((subItem) => (
              <NavSubItem
                key={subItem.label}
                item={subItem}
                isActive={activeSubPage !== null && subItem.page === activeSubPage}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={handleNavigateTop}
      className={cn(buttonClass, 'h-auto')}
    >
      {content}
    </Button>
  );
});

const SidebarNavContent = React.memo(function SidebarNavContent({
  navCategories,
  currentPage,
  autoOpenLabels,
  userOpenSubmenus,
  onNavigate,
  onToggleSubmenu,
}: {
  navCategories: NavCategory[];
  currentPage: NavPage;
  autoOpenLabels: ReadonlySet<string>;
  userOpenSubmenus: ReadonlySet<string>;
  onNavigate: (page: NavPage) => void;
  onToggleSubmenu: (itemLabel: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 pt-4">
      <div className="flex flex-col gap-4">
        {navCategories.map((category) => (
          <div key={category.title}>
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              {category.title}
            </div>
            <nav className="flex flex-col items-stretch gap-[2px]">
              {category.items.map((item) => {
                const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);
                const activeSubPage =
                  item.submenu?.some((s) => s.page === currentPage) === true ? currentPage : null;
                const isItemActive = item.page === currentPage || activeSubPage !== null;
                const isSubmenuOpen =
                  hasSubmenu &&
                  (autoOpenLabels.has(item.label) || userOpenSubmenus.has(item.label));
                return (
                  <NavItem
                    key={item.label}
                    item={item}
                    isActive={isItemActive}
                    activeSubPage={activeSubPage}
                    isSubmenuOpen={isSubmenuOpen}
                    onNavigate={onNavigate}
                    onToggleSubmenu={onToggleSubmenu}
                  />
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );
});

export function Sidebar({
  currentPage,
  onPageChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const enabledPlugins = useEnabledPlugins();
  const { t, i18n } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [userOpenSubmenus, setUserOpenSubmenus] = useState<Set<string>>(() => new Set());

  const navCategories = useMemo(() => {
    const categoriesMap = new Map<string, NavItemData[]>();
    categoriesMap.set('Main', [
      { label: t('nav.dashboard'), icon: Home, page: 'dashboard' as NavPage, order: 0 },
    ]);

    PLUGIN_REGISTRY.forEach((plugin) => {
      const isEnabled = enabledPlugins.has(plugin.name);
      if (isEnabled && plugin.navigation) {
        const { category, icon, order, submenu, badge } = plugin.navigation;
        if (!categoriesMap.has(category)) {
          categoriesMap.set(category, []);
        }
        const sortedSubmenu = submenu
          ? [...submenu]
              .sort((a, b) => a.order - b.order)
              .map((sub) => ({
                label: t(`nav.${sub.page}` as 'nav.slots'),
                icon: sub.icon,
                page: sub.page as NavPage,
                order: sub.order,
              }))
          : undefined;
        categoriesMap.get(category)!.push({
          label: t(`nav.${plugin.name}` as 'nav.slots'),
          icon,
          page: plugin.name as NavPage,
          order,
          badge,
          submenu: sortedSubmenu,
        });
      }
    });

    categoriesMap.forEach((items) => {
      items.sort((a, b) => a.order - b.order);
    });

    const categoryToKey: Record<string, string> = {
      Main: 'main',
      Business: 'business',
      'E-commerce': 'ecommerce',
      Tools: 'tools',
      Account: 'account',
    };
    return categoryOrder
      .filter((category) => categoriesMap.has(category))
      .map((category) => ({
        title: t(`nav.${categoryToKey[category] || category.toLowerCase()}` as 'nav.main'),
        items: categoriesMap.get(category)!,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t följer i18n.language vid språkbyte
  }, [enabledPlugins, i18n.language]);

  const autoOpenLabels = useMemo(() => {
    const labels = new Set<string>();
    navCategories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.submenu?.some((sub) => sub.page === currentPage)) {
          labels.add(item.label);
        }
      });
    });
    return labels;
  }, [currentPage, navCategories]);

  const handleNavigate = useCallback(
    (page: NavPage) => {
      if (isMobile) {
        onMobileOpenChange(false);
      }
      onPageChange(page);
    },
    [isMobile, onMobileOpenChange, onPageChange],
  );

  const handleToggleSubmenu = useCallback((itemLabel: string) => {
    setUserOpenSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(itemLabel)) {
        next.delete(itemLabel);
      } else {
        next.add(itemLabel);
      }
      return next;
    });
  }, []);

  return (
    <>
      <aside className="fixed left-0 top-0 z-10 hidden h-screen w-[252px] flex-shrink-0 bg-workspace border-r border-border/50 md:flex">
        <div className="flex h-full flex-col pt-14">
          <SidebarNavContent
            navCategories={navCategories}
            currentPage={currentPage}
            autoOpenLabels={autoOpenLabels}
            userOpenSubmenus={userOpenSubmenus}
            onNavigate={handleNavigate}
            onToggleSubmenu={handleToggleSubmenu}
          />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 border-border/60 bg-workspace p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>{t('nav.navigation')}</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6 pt-2">
            <div className="flex flex-col">
              <SidebarNavContent
                navCategories={navCategories}
                currentPage={currentPage}
                autoOpenLabels={autoOpenLabels}
                userOpenSubmenus={userOpenSubmenus}
                onNavigate={handleNavigate}
                onToggleSubmenu={handleToggleSubmenu}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
