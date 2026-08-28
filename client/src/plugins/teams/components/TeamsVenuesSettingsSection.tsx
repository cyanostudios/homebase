import { Check, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

import { useTeamVenues } from '../hooks/useTeamVenues';

const VENUE_CAP = 100;

export function TeamsVenuesSettingsSection() {
  const { t } = useTranslation();
  const { venues, isLoading, createVenue, updateVenue, deleteVenue } = useTeamVenues();
  const [newName, setNewName] = useState('');
  const [newMapLink, setNewMapLink] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMapLink, setEditMapLink] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const atCap = venues.length >= VENUE_CAP;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || atCap || isSaving) {
      return;
    }
    setIsSaving(true);
    setAddError(null);
    const result = await createVenue({ name, mapLink: newMapLink.trim() || null });
    setIsSaving(false);
    if (!result.ok) {
      setAddError(
        result.duplicate
          ? t('teams.settings.venuesDuplicate')
          : t('teams.settings.venuesSaveError'),
      );
      return;
    }
    setNewName('');
    setNewMapLink('');
  };

  const startEdit = (id: string) => {
    const venue = venues.find((item) => item.id === id);
    if (!venue) {
      return;
    }
    setEditingId(id);
    setEditName(venue.name);
    setEditMapLink(venue.mapLink ?? '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || isSaving) {
      return;
    }
    const name = editName.trim();
    if (!name) {
      return;
    }
    setIsSaving(true);
    setEditError(null);
    const result = await updateVenue(editingId, { name, mapLink: editMapLink.trim() || null });
    setIsSaving(false);
    if (!result.ok) {
      setEditError(
        result.duplicate
          ? t('teams.settings.venuesDuplicate')
          : t('teams.settings.venuesSaveError'),
      );
      return;
    }
    setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) {
      return;
    }
    setIsSaving(true);
    await deleteVenue(deleteId);
    setIsSaving(false);
    setDeleteId(null);
    if (editingId === deleteId) {
      setEditingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('teams.settings.venuesHint')}</p>

      <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
        {venues.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {t('teams.settings.venuesEmpty')}
          </li>
        ) : (
          venues.map((venue) => {
            const isEditing = editingId === venue.id;
            return (
              <li key={venue.id} className="px-4 py-2.5">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="h-9"
                        maxLength={255}
                      />
                      <Input
                        value={editMapLink}
                        onChange={(event) => setEditMapLink(event.target.value)}
                        className="h-9"
                        placeholder={t('matches.mapLinkPlaceholder')}
                      />
                      <div className="flex items-center gap-1">
                        <RoundIconLabelButton
                          type="button"
                          icon={Check}
                          label={t('common.save')}
                          variant="success"
                          size="xs"
                          expandOnHover={false}
                          disabled={isSaving || !editName.trim()}
                          onClick={() => void handleSaveEdit()}
                        />
                        <RoundIconLabelButton
                          type="button"
                          icon={X}
                          label={t('common.cancel')}
                          variant="secondary"
                          size="xs"
                          expandOnHover={false}
                          onClick={() => setEditingId(null)}
                        />
                      </div>
                    </div>
                    {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{venue.name}</span>
                      {venue.mapLink ? (
                        <MapPin
                          className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <RoundIconLabelButton
                        type="button"
                        icon={Pencil}
                        label={t('common.edit')}
                        variant="secondary"
                        size="xs"
                        expandOnHover={false}
                        disabled={isSaving}
                        onClick={() => startEdit(venue.id)}
                      />
                      <RoundIconLabelButton
                        type="button"
                        icon={Trash2}
                        label={t('common.delete')}
                        variant="dangerSoft"
                        size="xs"
                        expandOnHover={false}
                        disabled={isSaving}
                        onClick={() => setDeleteId(venue.id)}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value);
              setAddError(null);
            }}
            className="h-9"
            maxLength={255}
            placeholder={t('teams.settings.venuesNamePlaceholder')}
            disabled={atCap || isSaving}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAdd();
              }
            }}
          />
          <Input
            value={newMapLink}
            onChange={(event) => setNewMapLink(event.target.value)}
            className="h-9"
            placeholder={t('matches.mapLinkPlaceholder')}
            disabled={atCap || isSaving}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAdd();
              }
            }}
          />
          <RoundIconLabelButton
            type="button"
            icon={Plus}
            label={t('teams.settings.venuesAdd')}
            variant="secondary"
            size="xs"
            alwaysExpanded
            disabled={atCap || isSaving || !newName.trim()}
            onClick={() => void handleAdd()}
          />
        </div>
        {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
        {atCap ? (
          <p className="text-xs text-muted-foreground">{t('teams.settings.venuesLimit')}</p>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={deleteId != null}
        title={t('teams.settings.venuesDeleteTitle')}
        message={t('teams.settings.venuesDeleteMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        confirmDisabled={isSaving}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
