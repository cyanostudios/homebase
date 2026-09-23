import { Moon, Settings2, Sun } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useCompanionPanel } from '@/core/app/CompanionPanelContext';
import { getCompanionCandidates } from '@/core/companion/getCompanionCandidates';
import {
  resolveCompanionRailIcon,
  resolveCompanionRailTitleNavPage,
  shouldHideCompanionRailForPrimary,
} from '@/core/companion/companionPrimarySurface';
import type { NavPage } from '@/core/navigation/navTypes';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { pathToNavPage } from '@/core/routing/routeMap';
import { navigateToSettings } from '@/core/routing/settingsReturnTo';
import {
  RIGHT_SIDEBAR_COMPANION_FLYOUT_WIDTH_PX,
  RIGHT_SIDEBAR_WIDTH_PX,
  useRightSidebar,
} from '@/core/ui/RightSidebarContext';
import { PomodoroProvider } from '@/core/ui/rightSidebar/PomodoroContext';
import { PomodoroPanel } from '@/core/ui/rightSidebar/PomodoroPanel';
import { PomodoroRailButton } from '@/core/ui/rightSidebar/PomodoroRailButton';
import { RightSidebarFlyout } from '@/core/ui/rightSidebar/RightSidebarFlyout';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { TimerProvider } from '@/core/ui/rightSidebar/TimerContext';
import { TimerPanel } from '@/core/ui/rightSidebar/TimerPanel';
import { TimerRailButton } from '@/core/ui/rightSidebar/TimerRailButton';
import { UserAvatarButton } from '@/core/ui/rightSidebar/UserAvatarButton';
import { UserPrefsPanel } from '@/core/ui/rightSidebar/UserPrefsPanel';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useTheme } from '@/hooks/useTheme';

export function AppRightSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { activePanel, togglePanel, closePanel } = useRightSidebar();
  const { companionPlugin, toggleCompanionPanel, closeCompanionPanel } = useCompanionPanel();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const enabledPlugins = useEnabledPlugins();
  const currentPage = useMemo(() => pathToNavPage(location.pathname), [location.pathname]);
  const companionCandidates = useMemo(
    () =>
      getCompanionCandidates(enabledPlugins).filter(
        (entry) => !shouldHideCompanionRailForPrimary(entry, currentPage),
      ),
    [enabledPlugins, currentPage],
  );

  const companionRegistryEntry = companionPlugin
    ? PLUGIN_REGISTRY.find((plugin) => plugin.name === companionPlugin)
    : undefined;
  const companionEnabled = Boolean(
    companionPlugin &&
      getCompanionCandidates(enabledPlugins).some((entry) => entry.name === companionPlugin),
  );
  const CompanionListComp = companionEnabled
    ? (companionRegistryEntry?.components.List as
        | React.ComponentType<{ isCompanion?: boolean }>
        | undefined)
    : undefined;
  const companionOpen = Boolean(companionPlugin && CompanionListComp);

  const companionTitle = companionRegistryEntry
    ? t(`nav.${resolveCompanionRailTitleNavPage(companionRegistryEntry)}`, {
        defaultValue: companionRegistryEntry.navigation?.label ?? companionRegistryEntry.name,
      })
    : '';

  const handleOpenSettingsPage = useCallback(() => {
    attemptNavigation(() => {
      closePanel();
      closeCompanionPanel();
      navigateToSettings(navigate, `${location.pathname}${location.search}`);
    });
  }, [
    attemptNavigation,
    closePanel,
    closeCompanionPanel,
    navigate,
    location.pathname,
    location.search,
  ]);

  const handleToggleCompanion = useCallback(
    (plugin: NavPage) => {
      closePanel();
      toggleCompanionPanel(plugin);
    },
    [closePanel, toggleCompanionPanel],
  );

  const handleToggleWidget = useCallback(
    (id: 'pomodoro' | 'timer' | 'user') => {
      closeCompanionPanel();
      togglePanel(id);
    },
    [closeCompanionPanel, togglePanel],
  );

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

          <RightSidebarFlyout
            title={companionTitle}
            open={companionOpen}
            onClose={closeCompanionPanel}
            widthPx={RIGHT_SIDEBAR_COMPANION_FLYOUT_WIDTH_PX}
            className="bg-slate-100 dark:bg-slate-900"
            bodyClassName="p-0"
            titleClassName={PLUGIN_PAGE_TITLE_CLASS}
          >
            {CompanionListComp ? (
              <React.Suspense fallback={null}>
                <CompanionListComp isCompanion />
              </React.Suspense>
            ) : null}
          </RightSidebarFlyout>

          <aside
            className="relative z-40 flex h-full w-full flex-col items-start gap-2 bg-workspace py-3 pl-0.5 pr-4"
            style={{ width: RIGHT_SIDEBAR_WIDTH_PX }}
            aria-label={t('rightSidebar.rail')}
          >
            <UserAvatarButton
              active={activePanel === 'user'}
              onClick={() => handleToggleWidget('user')}
            />
            <RoundIconLabelButton
              icon={isDark ? Moon : Sun}
              label={
                isDark
                  ? t('rightSidebar.darkMode', { defaultValue: 'Dark mode' })
                  : t('rightSidebar.lightMode', { defaultValue: 'Light mode' })
              }
              variant="category"
              size="xs"
              expandOnHover={false}
              onClick={toggleTheme}
            />
            <RoundIconLabelButton
              icon={Settings2}
              label={t('rightSidebar.settings')}
              variant="category"
              size="xs"
              expandOnHover={false}
              onClick={handleOpenSettingsPage}
            />
            <div className="flex flex-col items-start gap-2 pt-4">
              <PomodoroRailButton
                selected={activePanel === 'pomodoro'}
                onClick={() => handleToggleWidget('pomodoro')}
              />
              <TimerRailButton
                selected={activePanel === 'timer'}
                onClick={() => handleToggleWidget('timer')}
              />
            </div>
            {companionCandidates.length > 0 ? (
              <div className="flex flex-col items-start gap-2 pt-4">
                {companionCandidates.map((entry) => {
                  const Icon = resolveCompanionRailIcon(entry);
                  if (!Icon) {
                    return null;
                  }
                  const titleNavPage = resolveCompanionRailTitleNavPage(entry);
                  const pluginTitle = t(`nav.${titleNavPage}`, {
                    defaultValue: entry.navigation?.label ?? entry.name,
                  });
                  const open = companionPlugin === entry.name;
                  return (
                    <RoundIconLabelButton
                      key={entry.name}
                      icon={Icon}
                      label={t('rightSidebar.openCompanion', { name: pluginTitle })}
                      variant={open ? 'soft' : 'category'}
                      size="xs"
                      expandOnHover={false}
                      aria-pressed={open}
                      onClick={() => handleToggleCompanion(entry.name as NavPage)}
                    />
                  );
                })}
              </div>
            ) : null}
          </aside>
        </div>
      </TimerProvider>
    </PomodoroProvider>
  );
}
