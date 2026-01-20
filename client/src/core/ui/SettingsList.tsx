// client/src/core/ui/SettingsList.tsx
// Settings list component showing settings categories
// Updated: Added Activity Log category

import { User, Globe, History } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { ContentToolbar } from '@/core/ui/ContentToolbar';

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'profile' | 'preferences' | 'activity-log';
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

  const filteredCategories = useMemo(() => {
    const filtered = settingsCategories.filter(
      (category) =>
        category.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return filtered;
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search settings..."
      />

      <Card>
        <div className="divide-y divide-border">
          {filteredCategories.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm
                ? 'No settings categories found matching your search.'
                : 'No settings categories available.'}
            </div>
          ) : (
            filteredCategories.map((category, idx) => {
              const Icon = category.icon;
              return (
                <div key={category.id}>
                  <div
                    data-category-id={category.id}
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
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                        {category.label}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {category.description}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
