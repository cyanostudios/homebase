// Teams settings as full-page content matching Core Settings layout.

import { CalendarRange, Grip, LayoutGrid, MapPin } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';

import {
  getAvailableOverviewCardIds,
  normalizeCardOrder,
  type OverviewCardId,
} from '../types/teamOverviewCards';

import { TeamsVenuesSettingsSection } from './TeamsVenuesSettingsSection';

const TEAMS_SETTINGS_KEY = 'teams';

export type TeamsSettingsCategory = 'season' | 'overview' | 'venues';

interface TeamsSettingsViewProps {
  onClose?: () => void;
}

export function TeamsSettingsView({ onClose }: TeamsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const hasMatchesPlugin = enabledPlugins.has('matches');

  const [activeCategory, setActiveCategory] = useState<TeamsSettingsCategory>('season');
  const [activeSeason, setActiveSeason] = useState('');
  const [initialSeason, setInitialSeason] = useState('');
  const [overviewCardOrder, setOverviewCardOrder] = useState<OverviewCardId[]>(() =>
    getAvailableOverviewCardIds(hasMatchesPlugin),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReorderingCards, setIsReorderingCards] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<OverviewCardId | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<OverviewCardId | null>(null);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'season',
        label: t('teams.settingsCategories.season'),
        description: t('teams.settingsCategories.seasonDescription'),
        icon: CalendarRange,
      },
      {
        id: 'overview',
        label: t('teams.settingsCategories.overview'),
        description: t('teams.settingsCategories.overviewDescription'),
        icon: LayoutGrid,
      },
      {
        id: 'venues',
        label: t('teams.settingsCategories.venues'),
        description: t('teams.settingsCategories.venuesDescription'),
        icon: MapPin,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = String(settings?.activeSeason || new Date().getFullYear());
        setActiveSeason(loaded);
        setInitialSeason(loaded);
        setOverviewCardOrder(normalizeCardOrder(settings?.overviewCardOrder, hasMatchesPlugin));
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = String(new Date().getFullYear());
          setActiveSeason(fallback);
          setInitialSeason(fallback);
          setOverviewCardOrder(getAvailableOverviewCardIds(hasMatchesPlugin));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, hasMatchesPlugin]);

  const isDirty = activeSeason !== initialSeason;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(TEAMS_SETTINGS_KEY, { activeSeason: activeSeason.trim() });
      setInitialSeason(activeSeason);
    } catch (error) {
      console.error('Failed to save teams settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeSeason, updateSettings]);

  const reorderCards = useCallback(
    async (sourceId: OverviewCardId, targetId: OverviewCardId) => {
      if (sourceId === targetId) {
        return;
      }

      let nextOrder: OverviewCardId[] | null = null;
      let rollbackOrder: OverviewCardId[] | null = null;

      setOverviewCardOrder((prev) => {
        const fromIndex = prev.indexOf(sourceId);
        const toIndex = prev.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return prev;
        }

        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        nextOrder = next;
        rollbackOrder = prev;
        return next;
      });

      if (!nextOrder || !rollbackOrder) {
        return;
      }

      setIsReorderingCards(true);
      try {
        await updateSettings(TEAMS_SETTINGS_KEY, { overviewCardOrder: nextOrder });
      } catch (error) {
        console.error('Failed to save overview card order:', error);
        setOverviewCardOrder(rollbackOrder);
      } finally {
        setIsReorderingCards(false);
      }
    },
    [updateSettings],
  );

  const handleDragStart = (e: React.DragEvent, cardId: OverviewCardId) => {
    setDraggingCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDragOver = (e: React.DragEvent, cardId: OverviewCardId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingCardId && draggingCardId !== cardId) {
      setDragOverCardId(cardId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: OverviewCardId) => {
    e.preventDefault();
    const sourceId = (e.dataTransfer.getData('text/plain') || draggingCardId) as OverviewCardId;
    if (sourceId) {
      await reorderCards(sourceId, targetId);
    }
    setDraggingCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggingCardId(null);
    setDragOverCardId(null);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('teams.settings.title')}
      subtitle={t('teams.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as TeamsSettingsCategory)}
      onClose={onClose}
      onSave={isDirty ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      {activeCategory === 'season' && (
        <DetailSection title={t('teams.settings.seasonSection')} className="pt-0">
          <div className="space-y-1">
            <Input
              value={activeSeason}
              onChange={(e) => setActiveSeason(e.target.value)}
              placeholder={String(new Date().getFullYear())}
              className="max-w-[200px]"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {t('teams.settings.activeSeasonHint')}
            </p>
          </div>
        </DetailSection>
      )}

      {activeCategory === 'overview' && (
        <DetailSection title={t('teams.settings.overviewSection')} className="pt-0">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('teams.settings.overviewHint')}</p>
            <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
              {overviewCardOrder.map((cardId) => (
                <li
                  key={cardId}
                  draggable={!isReorderingCards}
                  onDragStart={(e) => handleDragStart(e, cardId)}
                  onDragOver={(e) => handleDragOver(e, cardId)}
                  onDrop={(e) => void handleDrop(e, cardId)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => {
                    if (dragOverCardId === cardId) {
                      setDragOverCardId(null);
                    }
                  }}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                    draggingCardId === cardId && 'opacity-50',
                    dragOverCardId === cardId && 'bg-muted/60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Grip
                      className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                      aria-hidden
                    />
                    <span className="text-sm font-medium">
                      {t(`teams.settings.cards.${cardId}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </DetailSection>
      )}

      {activeCategory === 'venues' && (
        <DetailSection title={t('teams.settings.venuesSection')} className="pt-0">
          <TeamsVenuesSettingsSection />
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
