// client/src/core/ui/SettingsList.tsx
// Settings list component showing settings categories

import { User, Globe } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { GroupedList } from '@/core/ui/GroupedList';
import { Heading, Text } from '@/core/ui/Typography';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'profile' | 'preferences';
  description: string;
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'profile',
    label: 'User Profile',
    icon: User,
    category: 'profile',
    description: 'Manage your profile information',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Globe,
    category: 'preferences',
    description: 'Configure your preferences',
  },
];

interface SettingsListProps {
  onCategoryClick: (categoryId: string) => void;
}

export function SettingsList({ onCategoryClick }: SettingsListProps) {
  const [searchTerm, _setSearchTerm] = useState('');

  const filteredCategories = useMemo(() => {
    return settingsCategories.filter(
      (category) =>
        category.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <Heading level={1}>Settings ({filteredCategories.length})</Heading>
        <Text variant="caption">Manage your account settings and preferences</Text>
      </div>

      <Card>
        <GroupedList
          items={filteredCategories}
          groupConfig={null}
          emptyMessage={
            searchTerm
              ? 'No settings categories found matching your search.'
              : 'No settings categories available.'
          }
          renderItem={(category, idx) => {
            const Icon = category.icon;
            return (
              <div
                key={category.id}
                className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
                tabIndex={0}
                role="button"
                aria-label={`Open ${category.label} settings`}
                onClick={(e) => {
                  e.preventDefault();
                  onCategoryClick(category.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCategoryClick(category.id);
                  }
                }}
              >
                {/* Rad 1: Icon + Label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                    {category.label}
                  </div>
                </div>

                {/* Rad 2: Description */}
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {category.description}
                </div>
              </div>
            );
          }}
        />
      </Card>
    </div>
  );
}
