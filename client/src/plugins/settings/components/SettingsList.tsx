// Core Settings: Contacts-style page shell — header, category cards, detail content card.

import { Building2, Check, Globe, History, Users, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { navPageToPath } from '@/core/routing/routeMap';
import type { SettingsCategory as SettingsCategoryType } from '@/core/settings/types';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import { SettingsCategoryCard } from '@/core/ui/SettingsCategoryCard';

import { useSettingsContext } from '../context/SettingsContext';

import { SettingsForm } from './SettingsForm';

const SETTINGS_RETURN_TO_KEY = 'homebase:settings-return-to';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: SettingsCategoryType;
  description: string;
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Globe,
    category: 'preferences',
    description: 'Theme, language, and timezone',
  },
  {
    id: 'profile',
    label: 'Account profile',
    icon: Building2,
    category: 'profile',
    description: 'Shared account identity and billing',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    category: 'team',
    description: 'Your profile, members, and roles',
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: History,
    category: 'activity-log',
    description: 'Account activity history',
  },
];

function isSafeReturnPath(path: string | null | undefined): path is string {
  return Boolean(
    path &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      path !== navPageToPath.settings &&
      !path.startsWith(`${navPageToPath.settings}?`),
  );
}

export function SettingsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { submitSave, isSaving, hasChanges } = useSettingsContext();
  const returnToRef = useRef<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(settingsCategories[0].id);

  const isReadOnlyCategory = selectedCategory === 'activity-log';
  const usesOwnCards = selectedCategory === 'profile' || selectedCategory === 'team';
  const showSave = !isReadOnlyCategory && hasChanges;

  useEffect(() => {
    const fromState = (location.state as { from?: string } | null)?.from;
    if (isSafeReturnPath(fromState)) {
      returnToRef.current = fromState;
      try {
        sessionStorage.setItem(SETTINGS_RETURN_TO_KEY, fromState);
      } catch {
        // ignore quota / private mode
      }
      return;
    }
    if (returnToRef.current) {
      return;
    }
    try {
      const stored = sessionStorage.getItem(SETTINGS_RETURN_TO_KEY);
      if (isSafeReturnPath(stored)) {
        returnToRef.current = stored;
      }
    } catch {
      // ignore
    }
  }, [location.state]);

  const handleClose = () => {
    const target = returnToRef.current;
    try {
      sessionStorage.removeItem(SETTINGS_RETURN_TO_KEY);
    } catch {
      // ignore
    }
    if (isSafeReturnPath(target)) {
      navigate(target);
      return;
    }
    navigate(navPageToPath.dashboard);
  };

  useMobileBarOverride({
    onClose: handleClose,
    onSave: showSave ? () => void submitSave() : undefined,
    isSaving,
  });

  return (
    <div className="min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="hidden min-w-0 space-y-1 md:block">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.settings')}</h2>
            <p className="text-sm text-muted-foreground">
              Manage preferences, account profile, team, and activity.
            </p>
          </div>
          <div className="hidden w-full flex-shrink-0 items-center justify-end gap-2 md:flex md:w-auto md:gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              className="h-9 px-3 text-xs"
              onClick={handleClose}
            >
              {t('common.close')}
            </Button>
            {showSave ? (
              <Button
                type="button"
                onClick={() => submitSave()}
                variant="primary"
                size="sm"
                icon={Check}
                disabled={isSaving}
                className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {settingsCategories.map((category) => (
            <SettingsCategoryCard
              key={category.id}
              id={category.id}
              label={category.label}
              description={category.description}
              icon={category.icon}
              active={selectedCategory === category.id}
              onSelect={() => setSelectedCategory(category.id)}
            />
          ))}
        </div>

        {usesOwnCards ? (
          <SettingsForm currentItem={{ category: selectedCategory }} onCancel={() => {}} />
        ) : (
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <div className="p-4">
              <SettingsForm currentItem={{ category: selectedCategory }} onCancel={() => {}} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
