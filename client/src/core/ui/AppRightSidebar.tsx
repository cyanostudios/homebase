import { CalendarDays, Moon, Settings2, Sun } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useCompanionPanel } from '@/core/app/CompanionPanelContext';
import { pathToNavPage } from '@/core/routing/routeMap';
import { navigateToSettings } from '@/core/routing/settingsReturnTo';
import { RIGHT_SIDEBAR_WIDTH_PX, useRightSidebar } from '@/core/ui/RightSidebarContext';
import { PomodoroProvider } from '@/core/ui/rightSidebar/PomodoroContext';
import { PomodoroPanel } from '@/core/ui/rightSidebar/PomodoroPanel';
import { PomodoroRailButton } from '@/core/ui/rightSidebar/PomodoroRailButton';
import { RightSidebarFlyout } from '@/core/ui/rightSidebar/RightSidebarFlyout';
import { TimerProvider } from '@/core/ui/rightSidebar/TimerContext';
import { TimerPanel } from '@/core/ui/rightSidebar/TimerPanel';
import { TimerRailButton } from '@/core/ui/rightSidebar/TimerRailButton';
import { UserAvatarButton } from '@/core/ui/rightSidebar/UserAvatarButton';
import { UserPrefsPanel } from '@/core/ui/rightSidebar/UserPrefsPanel';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useTheme } from '@/hooks/useTheme';

export function AppRightSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { activePanel, togglePanel, closePanel } = useRightSidebar();
  const { companionPlugin, toggleCompanionPanel } = useCompanionPanel();
  const enabledPlugins = useEnabledPlugins();
  const currentPage = useMemo(() => pathToNavPage(location.pathname), [location.pathname]);
  const showScheduleCompanion = currentPage === 'teams' && enabledPlugins.has('schedule');
  const scheduleCompanionOpen = companionPlugin === 'schedule';

  const handleOpenSettingsPage = useCallback(() => {
    closePanel();
    navigateToSettings(navigate, `${location.pathname}${location.search}`);
  }, [closePanel, navigate, location.pathname, location.search]);

  const handleToggleScheduleCompanion = useCallback(() => {
    closePanel();
    toggleCompanionPanel('schedule');
  }, [closePanel, toggleCompanionPanel]);

  const isDark = theme === 'dark';

  const flyoutTitle = useMemo(() => {
    switch (activePanel) {
      case 'pomodoro':
        return t('rightSidebar.pomodoro');
      case 'timer':
        return t('rightSidebar.timer');
      case 'user':
        return t('rightSidebar.userPrefs');
      default:
        return '';
    }
  }, [activePanel, t]);

  const renderFlyoutBody = () => {
    switch (activePanel) {
      case 'pomodoro':
        return <PomodoroPanel />;
      case 'timer':
        return <TimerPanel />;
      case 'user':
        return <UserPrefsPanel />;
      default:
        return null;
    }
  };

  return (
    <PomodoroProvider>
      <TimerProvider>
        <div
          className="relative hidden h-full shrink-0 lg:block"
          style={{ width: RIGHT_SIDEBAR_WIDTH_PX }}
        >
          <RightSidebarFlyout title={flyoutTitle} open={activePanel !== null} onClose={closePanel}>
            {renderFlyoutBody()}
          </RightSidebarFlyout>

          <aside
            className="relative z-40 flex h-full w-full flex-col items-start gap-2 bg-workspace py-3 pl-0.5 pr-4"
            style={{ width: RIGHT_SIDEBAR_WIDTH_PX }}
            aria-label={t('rightSidebar.rail')}
          >
            <UserAvatarButton active={activePanel === 'user'} onClick={() => togglePanel('user')} />
            <RoundIconLabelButton
              icon={isDark ? Moon : Sun}
              label={
                isDark
                  ? t('rightSidebar.darkMode', { defaultValue: 'Dark mode' })
                  : t('rightSidebar.lightMode', { defaultValue: 'Light mode' })
              }
              variant="secondary"
              size="xs"
              expandOnHover={false}
              onClick={toggleTheme}
            />
            <RoundIconLabelButton
              icon={Settings2}
              label={t('rightSidebar.settings')}
              variant="secondary"
              size="xs"
              expandOnHover={false}
              onClick={handleOpenSettingsPage}
            />
            <div className="flex flex-col items-start gap-2 pt-4">
              <PomodoroRailButton
                selected={activePanel === 'pomodoro'}
                onClick={() => togglePanel('pomodoro')}
              />
              <TimerRailButton
                selected={activePanel === 'timer'}
                onClick={() => togglePanel('timer')}
              />
            </div>
            {showScheduleCompanion ? (
              <div className="flex flex-col items-start gap-2 pt-4">
                <RoundIconLabelButton
                  icon={CalendarDays}
                  label={t('rightSidebar.openScheduleCompanion')}
                  variant={scheduleCompanionOpen ? 'soft' : 'secondary'}
                  size="xs"
                  expandOnHover={false}
                  aria-pressed={scheduleCompanionOpen}
                  onClick={handleToggleScheduleCompanion}
                />
              </div>
            ) : null}
          </aside>
        </div>
      </TimerProvider>
    </PomodoroProvider>
  );
}
