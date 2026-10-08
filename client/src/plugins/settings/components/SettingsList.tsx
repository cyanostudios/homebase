// Core Settings: PluginSettingsPageShell (same chrome as plugin settings pages).

import { Building2, FileText, Globe, History, Users } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { navPageToPath } from '@/core/routing/routeMap';
import {
  clearSettingsReturnPath,
  isSafeSettingsReturnPath,
  readSettingsReturnPath,
  rememberSettingsReturnPath,
} from '@/core/routing/settingsReturnTo';
import { hasDefaultTextsPlugins } from '@/core/settings/defaultTextsPluginGate';
import type { SettingsCategory as SettingsCategoryType } from '@/core/settings/types';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';

import { useSettingsContext } from '../context/SettingsContext';

import { SettingsForm } from './SettingsForm';

export function SettingsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { submitSave, isSaving, hasChanges } = useSettingsContext();
  const enabledPlugins = useEnabledPlugins();
  const showDefaultTexts = hasDefaultTextsPlugins(enabledPlugins);
  const returnToRef = useRef<string | null>(null);

  const categories: PluginSettingsCategory[] = useMemo(() => {
    const next: PluginSettingsCategory[] = [
      {
        id: 'preferences',
        label: t('preferences.title', { defaultValue: 'Preferences' }),
        description: t('preferences.description', {
          defaultValue: 'Theme, language, and timezone',
        }),
        icon: Globe,
      },
      {
        id: 'profile',
        label: t('profile.title', { defaultValue: 'Account profile' }),
        description: t('profile.description', {
          defaultValue: 'Shared account identity and billing',
        }),
        icon: Building2,
      },
    ];

    if (showDefaultTexts) {
      const hasInvoices = enabledPlugins.has('invoices');
      const hasEstimates = enabledPlugins.has('estimates');
      let descriptionKey = 'defaultTexts.description';
      let descriptionDefault = 'Default messages for invoice and estimate emails';
      if (hasInvoices && !hasEstimates) {
        descriptionKey = 'defaultTexts.descriptionInvoiceOnly';
        descriptionDefault = 'Default messages for invoice emails';
      } else if (!hasInvoices && hasEstimates) {
        descriptionKey = 'defaultTexts.descriptionEstimateOnly';
        descriptionDefault = 'Default messages for estimate emails';
      }

      next.push({
        id: 'default-texts',
        label: t('defaultTexts.title', { defaultValue: 'Default texts' }),
        description: t(descriptionKey, { defaultValue: descriptionDefault }),
        icon: FileText,
      });
    }

    next.push(
      {
        id: 'team',
        label: t('team.title', { defaultValue: 'Team' }),
        description: t('team.description', {
          defaultValue: 'Your profile, members, and roles',
        }),
        icon: Users,
      },
      {
        id: 'activity-log',
        label: t('activityLog.title', { defaultValue: 'Activity Log' }),
        description: t('activityLog.description', {
          defaultValue: 'Account activity history',
        }),
        icon: History,
      },
    );

    return next;
  }, [t, showDefaultTexts, enabledPlugins]);

  const [selectedCategory, setSelectedCategory] = useState<string>('preferences');

  useEffect(() => {
    if (selectedCategory === 'default-texts' && !showDefaultTexts) {
      setSelectedCategory('preferences');
    }
  }, [selectedCategory, showDefaultTexts]);

  const isReadOnlyCategory = selectedCategory === 'activity-log';
  const usesOwnCards =
    selectedCategory === 'preferences' ||
    selectedCategory === 'profile' ||
    selectedCategory === 'team' ||
    selectedCategory === 'default-texts';
  const showSave = !isReadOnlyCategory && hasChanges;

  useEffect(() => {
    const fromState = (location.state as { from?: string } | null)?.from;
    if (isSafeSettingsReturnPath(fromState)) {
      returnToRef.current = fromState;
      rememberSettingsReturnPath(fromState);
      return;
    }
    if (returnToRef.current) {
      return;
    }
    returnToRef.current = readSettingsReturnPath();
  }, [location.state]);

  const handleClose = () => {
    const target = returnToRef.current ?? readSettingsReturnPath();
    clearSettingsReturnPath();
    if (isSafeSettingsReturnPath(target)) {
      navigate(target);
      return;
    }
    navigate(navPageToPath.dashboard);
  };

  return (
    <div className="min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <PluginSettingsPageShell
        title={t('nav.settings')}
        categories={categories}
        activeCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onClose={handleClose}
        onSave={showSave ? () => void submitSave() : undefined}
        isSaving={isSaving}
        saveAction={
          showSave ? (
            <SettingsHeaderSaveButton onClick={() => void submitSave()} isSaving={isSaving} />
          ) : null
        }
        wrapContentInCard={!usesOwnCards}
      >
        <SettingsForm
          currentItem={{ category: selectedCategory as SettingsCategoryType }}
          onCancel={() => {}}
        />
      </PluginSettingsPageShell>
    </div>
  );
}
