import React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { GUIDE_LANGUAGE_BADGE_CLASS, GUIDE_LANGUAGE_SOURCE_BADGE_CLASS } from '../types/guides';

interface GuideLanguageBadgesProps {
  languages: string[];
  sourceLanguage?: string;
  className?: string;
}

export const GuideLanguageBadges: React.FC<GuideLanguageBadgesProps> = ({
  languages,
  sourceLanguage,
  className,
}) => {
  if (!languages.length) {
    return <span className="text-muted-foreground">—</span>;
  }

  const source = sourceLanguage?.toLowerCase().slice(0, 2);

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {languages.map((lang) => {
        const code = lang.toLowerCase();
        const isSource = source && code.slice(0, 2) === source;
        return (
          <Badge
            key={code}
            className={isSource ? GUIDE_LANGUAGE_SOURCE_BADGE_CLASS : GUIDE_LANGUAGE_BADGE_CLASS}
          >
            {code}
          </Badge>
        );
      })}
    </div>
  );
};
