import {
  Building2,
  Globe,
  History,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Timer,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { navPageToPath } from '@/core/routing/routeMap';
import {
  RIGHT_SIDEBAR_COLLAPSED_WIDTH_PX,
  RIGHT_SIDEBAR_EXPANDED_WIDTH_PX,
  RIGHT_SIDEBAR_PLUGIN_SLOT_ID,
  useRightSidebar,
} from '@/core/ui/RightSidebarContext';
import { getTopBarWidgets } from '@/core/widgets';
import { cn } from '@/lib/utils';
import { useSettings } from '@/plugins/settings/hooks/useSettings';

const SETTINGS_SHORTCUTS = [
  { id: 'preferences', labelKey: 'rightSidebar.settingsPreferences', icon: Globe },
  { id: 'profile', labelKey: 'rightSidebar.settingsProfile', icon: Building2 },
  { id: 'team', labelKey: 'rightSidebar.settingsTeam', icon: Users },
  { id: 'activity-log', labelKey: 'rightSidebar.settingsActivityLog', icon: History },
] as const;

export function AppRightSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getSettings, settingsVersion, user } = useApp();
  const { openSettingsPanel } = useSettings();
  const { isOpen, toggle, setPluginSlotElement } = useRightSidebar();

  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);
  const [pomodoroClockEnabled, setPomodoroClockEnabled] = useState(true);
  const [timeTrackingEnabled, setTimeTrackingEnabled] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getSettings('preferences');
        setPomodoroClockEnabled(prefs?.pomodoroClockEnabled !== false);
        setTimeTrackingEnabled(prefs?.timeTrackingEnabled !== false);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };

    if (user) {
      void loadPreferences();
    }
  }, [user, getSettings, settingsVersion]);

  const handleWidgetToggle = useCallback((widgetId: string) => {
    setOpenWidgetId((current) => (current === widgetId ? null : widgetId));
  }, []);

  const handleCloseWidgetPanel = useCallback(() => {
    setOpenWidgetId(null);
  }, []);

  const topBarWidgets = useMemo(() => {
    const all = getTopBarWidgets();
    return all.filter((w) => {
      if (w.id === 'pomodoro') {
        return pomodoroClockEnabled;
      }
      if (w.id === 'time-tracking') {
        return timeTrackingEnabled;
      }
      return true;
    });
  }, [pomodoroClockEnabled, timeTrackingEnabled]);

  const handleSettingsShortcut = useCallback(
    (categoryId: string) => {
      openSettingsPanel(categoryId);
    },
    [openSettingsPanel],
  );

  const handleOpenSettingsPage = useCallback(() => {
    navigate(navPageToPath.settings);
  }, [navigate]);

  const slotRef = useCallback(
    (node: HTMLDivElement | null) => {
      setPluginSlotElement(node);
    },
    [setPluginSlotElement],
  );

  const widthPx = isOpen ? RIGHT_SIDEBAR_EXPANDED_WIDTH_PX : RIGHT_SIDEBAR_COLLAPSED_WIDTH_PX;

  return (
    <aside
      className="hidden h-full shrink-0 flex-col border-l border-border/40 bg-workspace transition-[width] duration-200 ease-out lg:flex"
      style={{ width: widthPx }}
      aria-label={t('rightSidebar.toggle')}
    >
      <div className="flex h-12 shrink-0 items-center justify-end border-b border-border/40 px-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-label={t('rightSidebar.toggle')}
          title={t('rightSidebar.toggle')}
        >
          {isOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!isOpen ? (
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
          {topBarWidgets.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggle}
              aria-label={t('rightSidebar.widgets')}
              title={t('rightSidebar.widgets')}
            >
              <Timer className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              toggle();
            }}
            aria-label={t('rightSidebar.settings')}
            title={t('rightSidebar.settings')}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <section className="space-y-2 border-b border-border/40 p-3">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('rightSidebar.widgets')}
            </h3>
            <div className="flex flex-col gap-2">
              {topBarWidgets.map((widget) => {
                const WidgetComponent = widget.component;
                return (
                  <div key={widget.id} className="min-w-0">
                    <WidgetComponent
                      compact
                      isExpanded={openWidgetId === widget.id}
                      onToggle={() => handleWidgetToggle(widget.id)}
                      onClose={handleCloseWidgetPanel}
                    />
                  </div>
                );
              })}
              {topBarWidgets.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{t('rightSidebar.noWidgets')}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2 border-b border-border/40 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('rightSidebar.settings')}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleOpenSettingsPage}
              >
                {t('nav.settings')}
              </Button>
            </div>
            <div className="flex flex-col gap-0.5">
              {SETTINGS_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Icon}
                    className="h-9 justify-start rounded-md px-3 text-xs"
                    onClick={() => handleSettingsShortcut(item.id)}
                  >
                    {t(item.labelKey)}
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col p-3">
            <h3
              className={cn(
                'mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              {t('rightSidebar.details')}
            </h3>
            <div
              id={RIGHT_SIDEBAR_PLUGIN_SLOT_ID}
              ref={slotRef}
              className="min-h-0 flex-1 space-y-6"
            />
          </section>
        </div>
      )}
    </aside>
  );
}
