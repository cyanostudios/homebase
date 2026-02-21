// Files settings as full-page content (like Core Settings / Notes): tab row + card.

import { Cloud } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { cn } from '@/lib/utils';

import { CloudStorageSettings } from './CloudStorageSettings';

const fileSettingsCategories = [{ id: 'cloud', label: 'Cloud storage', icon: Cloud }];

export function FileSettingsView() {
  const { setHeaderTrailing } = useContentLayout();
  const [selectedCategory, setSelectedCategory] = useState(fileSettingsCategories[0].id);

  useEffect(() => {
    setHeaderTrailing(
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {fileSettingsCategories.map((category) => {
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

  return (
    <div className="space-y-4">
      <Card
        padding="md"
        className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
      >
        {selectedCategory === 'cloud' && <CloudStorageSettings />}
      </Card>
    </div>
  );
}
