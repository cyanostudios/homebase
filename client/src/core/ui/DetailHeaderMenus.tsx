import type { LucideIcon } from 'lucide-react';
import { Download, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import type { AppIcon } from '@/types/icons';
import { cn } from '@/lib/utils';

export type DetailHeaderMenuAction = {
  id: string;
  label: string;
  icon: AppIcon | LucideIcon;
  onClick: () => void;
  variant?: 'soft' | 'secondary' | 'primary' | 'danger' | 'dangerSoft' | 'success' | 'successSoft';
  contentClassName?: string;
  disabled?: boolean;
};

export type DetailHeaderExtraMenu = {
  id: string;
  label: string;
  icon: AppIcon | LucideIcon;
  badgeCount?: number;
  badgeAriaLabel?: string;
  content: React.ReactNode;
};

export type DetailHeaderMenusProps = {
  /** Primary action buttons shown when Actions is open. */
  actions: DetailHeaderMenuAction[];
  /** Optional export / share buttons shown when Export is open. */
  exportActions?: DetailHeaderMenuAction[];
  /** Optional extra toggle menus (e.g. Contacts time log). */
  extraMenus?: DetailHeaderExtraMenu[];
  /** Rendered in the trigger row immediately after the Actions control (e.g. quick-add). */
  afterActions?: React.ReactNode;
  actionsLabel?: string;
  exportLabel?: string;
  /** Dialogs / portals owned by the caller (delete confirm, duplicate, …). */
  children?: React.ReactNode;
};

/** Phone: triggers + open submenu inline with horizontal scroll. Desktop: wrap triggers only. */
const DETAIL_HEADER_TRIGGER_ROW_CLASS =
  'flex min-w-0 items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth md:flex-wrap md:overflow-visible';

/** Phone: submenu pills beside the trigger; desktop: full row below triggers. */
const DETAIL_HEADER_SUBMENU_INLINE_CLASS = 'flex shrink-0 items-center gap-1 md:hidden';

const DETAIL_HEADER_SUBMENU_DESKTOP_CLASS = 'hidden flex-wrap items-center gap-1 md:flex';

function DetailHeaderActionPills({ actions }: { actions: DetailHeaderMenuAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <RoundIconLabelButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          variant={action.variant ?? 'secondary'}
          alwaysExpanded
          disabled={action.disabled}
          contentClassName={action.contentClassName}
          className="shrink-0"
          onClick={action.onClick}
        />
      ))}
    </>
  );
}

function DetailHeaderExtraMenuTrigger({
  menu,
  isOpen,
  onToggle,
}: {
  menu: DetailHeaderExtraMenu;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="relative inline-flex shrink-0 overflow-visible">
      <RoundIconLabelButton
        icon={menu.icon}
        label={menu.label}
        variant={isOpen ? 'primary' : 'soft'}
        alwaysExpanded
        onClick={onToggle}
      />
      {typeof menu.badgeCount === 'number' && menu.badgeCount > 0 ? (
        <span
          className="absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-0.5 text-[10px] font-extrabold leading-none text-white shadow-sm ring-2 ring-background"
          aria-label={menu.badgeAriaLabel}
          title={menu.badgeAriaLabel}
        >
          {menu.badgeCount > 99 ? '99+' : menu.badgeCount}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Shared detail-panel header toggle menus (Actions / Export / extras).
 * Phone: open submenu scrolls horizontally beside its trigger; desktop: submenu wraps on a second row.
 */
export function DetailHeaderMenus({
  actions,
  exportActions = [],
  extraMenus = [],
  afterActions,
  actionsLabel,
  exportLabel,
  children,
}: DetailHeaderMenusProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const hasExport = exportActions.length > 0;
  const resolvedActionsLabel =
    actionsLabel ?? t('common.headerActions', { defaultValue: 'Actions' });
  const resolvedExportLabel = exportLabel ?? t('common.headerExport', { defaultValue: 'Export' });

  const toggleMenu = (menu: string) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const actionsOpen = openMenu === 'actions';
  const exportOpen = openMenu === 'export' && hasExport;

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col md:gap-5">
        <div className={DETAIL_HEADER_TRIGGER_ROW_CLASS}>
          <span className="inline-flex shrink-0">
            <RoundIconLabelButton
              icon={Zap}
              label={resolvedActionsLabel}
              variant={actionsOpen ? 'primary' : 'soft'}
              alwaysExpanded
              onClick={() => toggleMenu('actions')}
            />
          </span>
          {afterActions ? <span className="inline-flex shrink-0">{afterActions}</span> : null}
          {actionsOpen ? (
            <div className={DETAIL_HEADER_SUBMENU_INLINE_CLASS}>
              <DetailHeaderActionPills actions={actions} />
            </div>
          ) : null}
          {hasExport ? (
            <>
              <span className="inline-flex shrink-0">
                <RoundIconLabelButton
                  icon={Download}
                  label={resolvedExportLabel}
                  variant={exportOpen ? 'primary' : 'soft'}
                  alwaysExpanded
                  onClick={() => toggleMenu('export')}
                />
              </span>
              {exportOpen ? (
                <div className={DETAIL_HEADER_SUBMENU_INLINE_CLASS}>
                  <DetailHeaderActionPills actions={exportActions} />
                </div>
              ) : null}
            </>
          ) : null}
          {extraMenus.map((menu) => {
            const isOpen = openMenu === menu.id;
            return (
              <React.Fragment key={menu.id}>
                <DetailHeaderExtraMenuTrigger
                  menu={menu}
                  isOpen={isOpen}
                  onToggle={() => toggleMenu(menu.id)}
                />
                {isOpen ? (
                  <div className={cn(DETAIL_HEADER_SUBMENU_INLINE_CLASS, 'items-stretch')}>
                    {menu.content}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        {actionsOpen ? (
          <div className={DETAIL_HEADER_SUBMENU_DESKTOP_CLASS}>
            <DetailHeaderActionPills actions={actions} />
          </div>
        ) : null}
        {exportOpen ? (
          <div className={DETAIL_HEADER_SUBMENU_DESKTOP_CLASS}>
            <DetailHeaderActionPills actions={exportActions} />
          </div>
        ) : null}
        {extraMenus.map((menu) =>
          openMenu === menu.id ? (
            <div key={`content-${menu.id}`} className={DETAIL_HEADER_SUBMENU_DESKTOP_CLASS}>
              {menu.content}
            </div>
          ) : null,
        )}
      </div>
      {children}
    </>
  );
}
