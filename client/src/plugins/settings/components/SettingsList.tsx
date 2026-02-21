// Core Settings: invoices-style tab row + content card. First tab (Profile) open by default.

import { Check, User, Globe, History, Users } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SettingsCategory as SettingsCategoryType } from '@/core/settings/types';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { cn } from '@/lib/utils';

import { useSettingsContext } from '../context/SettingsContext';

import { SettingsForm } from './SettingsForm';

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
    description: 'Configure your preferences',
  },
  {
    id: 'profile',
    label: 'User Profile',
    icon: User,
    category: 'profile',
    description: 'Manage your profile information',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    category: 'team',
    description: 'Manage members and roles for your account',
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: History,
    category: 'activity-log',
    description: 'View your activity history',
  },
];

export function SettingsList() {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { submitSave, isSaving, hasChanges } = useSettingsContext();

  // First tab (Preferences) is selected by default when opening Core Settings
  const [selectedCategory, setSelectedCategory] = useState<string>(settingsCategories[0].id);

  // Tabs on same row as title – set as header trailing
  useEffect(() => {
    setHeaderTrailing(
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setSelectedCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.label}</span>
            </Button>
          );
        })}
      </div>,
    );
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, selectedCategory]);

  const isReadOnlyCategory = selectedCategory === 'activity-log' || selectedCategory === 'team';

  return (
    <div className="space-y-4">
      <Card
        padding="md"
        className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
      >
        <SettingsForm currentItem={{ category: selectedCategory }} onCancel={() => {}} />
      </Card>

      {!isReadOnlyCategory && hasChanges && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => submitSave()}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
