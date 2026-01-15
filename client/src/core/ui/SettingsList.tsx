// client/src/core/ui/SettingsList.tsx
// Settings list component showing settings categories

import { User, Globe } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { Heading } from '@/core/ui/Typography';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'profile' | 'preferences';
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'profile',
    label: 'User Profile',
    icon: User,
    category: 'profile',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Globe,
    category: 'preferences',
  },
];

interface SettingsListProps {
  onCategoryClick: (categoryId: string) => void;
}

export function SettingsList({ onCategoryClick }: SettingsListProps) {
  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <Heading level={1}>Settings</Heading>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card
              key={category.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onCategoryClick(category.id)}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">{category.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {category.id === 'profile'
                      ? 'Manage your profile information'
                      : 'Configure your preferences'}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
