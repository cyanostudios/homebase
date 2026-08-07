// Core Settings: Contacts-style page shell — header, category cards, detail content card.

import { Check, User, Globe, History, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SettingsCategory as SettingsCategoryType } from '@/core/settings/types';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SettingsCategoryCard } from '@/core/ui/SettingsCategoryCard';

import { useSettingsContext } from '../context/SettingsContext';

import { SettingsForm } from './SettingsForm';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: SettingsCategoryType;
  description: string;
  dotClassName: string;
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Globe,
    category: 'preferences',
    description: 'Theme, language, and timezone',
    dotClassName: 'bg-blue-500',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    category: 'profile',
    description: 'Your details and account identity',
    dotClassName: 'bg-emerald-500',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    category: 'team',
    description: 'Members and roles',
    dotClassName: 'bg-amber-500',
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: History,
    category: 'activity-log',
    description: 'Account activity history',
    dotClassName: 'bg-orange-500',
  },
];

export function SettingsList() {
  const { t } = useTranslation();
  const { submitSave, isSaving, hasChanges } = useSettingsContext();

  const [selectedCategory, setSelectedCategory] = useState<string>(settingsCategories[0].id);

  const isReadOnlyCategory = selectedCategory === 'activity-log' || selectedCategory === 'team';

  return (
    <div className="min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.settings')}</h2>
            <p className="text-sm text-muted-foreground">
              Manage preferences, profile, team, and activity.
            </p>
          </div>
          {!isReadOnlyCategory && hasChanges ? (
            <div className="flex flex-shrink-0 items-center gap-1">
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
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {settingsCategories.map((category) => (
            <SettingsCategoryCard
              key={category.id}
              id={category.id}
              label={category.label}
              description={category.description}
              icon={category.icon}
              dotClassName={category.dotClassName}
              active={selectedCategory === category.id}
              onSelect={() => setSelectedCategory(category.id)}
            />
          ))}
        </div>

        {selectedCategory === 'profile' ? (
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
