// client/src/core/ui/SettingsList.tsx
// Settings list component showing settings categories
// Updated: Added Activity Log category

import { User, Globe, History } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Card } from '@/components/ui/card';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { SettingsCategory as SettingsCategoryType } from '@/core/settings/types';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: SettingsCategoryType;
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
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: History,
    category: 'activity-log',
    description: 'View your activity history',
  },
];

interface SettingsListProps {
  onCategoryClick: (categoryId: string) => void;
}

export function SettingsList({ onCategoryClick }: SettingsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { setHeaderTrailing } = useContentLayout();

  const filteredCategories = useMemo(() => {
    const filtered = settingsCategories.filter(
      (category) =>
        category.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return filtered;
  }, [searchTerm]);

  // Set header trailing (search + filter) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search settings..."
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, setHeaderTrailing]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredCategories.length === 0 ? (
        <div className="col-span-full flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground bg-background/50">
          <p>
            {searchTerm
              ? 'No settings categories found matching your search.'
              : 'No settings categories available.'}
          </p>
        </div>
      ) : (
        filteredCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card
              key={category.id}
              className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
              role="button"
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
              <div className="p-6 flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-full bg-primary/5 text-primary">
                  <Icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">{category.label}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {category.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
