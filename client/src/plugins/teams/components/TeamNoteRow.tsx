import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { TeamNote } from '../types/teams';

export function TeamNoteRow({ note, onRemove }: { note: TeamNote; onRemove?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="m-0 whitespace-pre-wrap text-sm leading-normal">{note.text}</p>
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-shrink-0 px-2 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title={t('teams.view.removeNote')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
