import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import type { TeamNote } from '../types/teams';

import { TeamNoteRow } from './TeamNoteRow';

export function TeamNotesSection({
  notes,
  onAdd,
  onRemoveRequest,
  showAdd = true,
}: {
  notes: TeamNote[];
  onAdd: (text: string) => void | Promise<void>;
  onRemoveRequest: (note: TeamNote) => void;
  /** When false, only list notes (e.g. overview tab). */
  showAdd?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    setIsAdding(true);
    try {
      await onAdd(trimmed);
      setDraft('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('teams.view.noNotes')}</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map((note) => (
              <TeamNoteRow key={note.id} note={note} onRemove={() => onRemoveRequest(note)} />
            ))}
          </div>
        )}
      </div>
      {showAdd && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('teams.view.addNote')}
          </h4>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={t('teams.view.notePlaceholder')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={handleAdd}
            disabled={isAdding || !draft.trim()}
          >
            {t('teams.view.addNote')}
          </Button>
        </div>
      )}
    </div>
  );
}
