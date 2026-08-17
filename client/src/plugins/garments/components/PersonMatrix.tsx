import { Plus } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList, GarmentPerson } from '../types/garments';
import {
  findDuplicateJerseyNumbers,
  personsWithEditingJersey,
  toggleCheckboxValue,
} from '../utils/garmentListFilter';

import { PersonBlock } from './PersonBlock';

export function PersonMatrix({
  list,
  readOnly = false,
  hideComment = false,
}: {
  list: GarmentList;
  readOnly?: boolean;
  hideComment?: boolean;
}) {
  const { t } = useTranslation();
  const { addPerson, updatePerson, deletePerson } = useGarments();
  const persons = list.persons ?? [];
  const columns = [...(list.checkboxColumns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<GarmentPerson>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const duplicateJerseys = useMemo(() => {
    const forDup = personsWithEditingJersey(persons, editingId, editDraft.jerseyNumber);
    return findDuplicateJerseyNumbers(forDup);
  }, [persons, editingId, editDraft.jerseyNumber]);

  const handleAdd = async () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    await addPerson(list.id, { name });
    setDraftName('');
  };

  const startEdit = (person: GarmentPerson) => {
    setEditingId(person.id);
    setEditDraft({ ...person });
  };

  const saveEdit = async () => {
    if (!editingId) {
      return;
    }
    await updatePerson(list.id, editingId, {
      name: (editDraft.name ?? '').trim(),
      shirtSize: editDraft.shirtSize ?? null,
      shortsSize: editDraft.shortsSize ?? null,
      socksSize: editDraft.socksSize ?? null,
      jerseyNumber: editDraft.jerseyNumber ?? null,
      comment: editDraft.comment ?? null,
      checkboxValues: editDraft.checkboxValues ?? {},
    });
    setEditingId(null);
  };

  const toggleCheckbox = async (person: GarmentPerson, columnId: string) => {
    if (readOnly) {
      return;
    }
    const editingThis = editingId === person.id;
    const currentValues = editingThis
      ? (editDraft.checkboxValues ?? person.checkboxValues)
      : person.checkboxValues;
    const next = toggleCheckboxValue(currentValues, columnId);
    if (editingThis) {
      setEditDraft((prev) => ({ ...prev, checkboxValues: next }));
    }
    await updatePerson(list.id, person.id, {
      name: person.name,
      shirtSize: person.shirtSize,
      shortsSize: person.shortsSize,
      socksSize: person.socksSize,
      jerseyNumber: person.jerseyNumber,
      comment: person.comment,
      checkboxValues: next,
    });
  };

  return (
    <div className="space-y-3">
      {duplicateJerseys.size > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('garments.jerseyDuplicateWarning')}
        </div>
      ) : null}

      {persons.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('garments.noPersons')}</p>
      ) : (
        <ul className="rounded-md border border-border">
          {persons.map((person) => {
            const isEditing = !readOnly && editingId === person.id;
            return (
              <PersonBlock
                key={person.id}
                person={person}
                columns={columns}
                hideComment={hideComment}
                readOnly={readOnly}
                isEditing={isEditing}
                editDraft={isEditing ? editDraft : {}}
                jerseyDup={duplicateJerseys.has(person.id)}
                onStartEdit={() => startEdit(person)}
                onSave={() => void saveEdit()}
                onCancel={() => setEditingId(null)}
                onDelete={() => setDeletingId(person.id)}
                onToggleCheckbox={(columnId) => void toggleCheckbox(person, columnId)}
                onDraftChange={(patch) => setEditDraft((prev) => ({ ...prev, ...patch }))}
              />
            );
          })}
        </ul>
      )}

      {!readOnly ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="add-person-name">{t('garments.addPerson')}</Label>
            <Input
              id="add-person-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder={t('garments.personNamePlaceholder')}
              className="h-9"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => void handleAdd()}
            disabled={!draftName.trim()}
          >
            {t('garments.addPerson')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deletingId != null}
        title={t('garments.deletePerson')}
        message={t('garments.deletePersonConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (deletingId) {
            void deletePerson(list.id, deletingId);
          }
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
        variant="danger"
      />
    </div>
  );
}

export function PublicPersonMatrix({ list }: { list: GarmentList }) {
  const persons = list.persons ?? [];
  const columns = [...(list.checkboxColumns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  if (persons.length === 0) {
    return <PublicEmptyPersons />;
  }

  return (
    <ul className="rounded-md border border-border">
      {persons.map((person) => (
        <PersonBlock
          key={person.id}
          person={person}
          columns={columns}
          hideComment
          readOnly
          isEditing={false}
          editDraft={{}}
          jerseyDup={false}
          onStartEdit={() => {}}
          onSave={() => {}}
          onCancel={() => {}}
          onDelete={() => {}}
          onToggleCheckbox={() => {}}
          onDraftChange={() => {}}
        />
      ))}
    </ul>
  );
}

function PublicEmptyPersons() {
  const { t } = useTranslation();
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{t('garments.noPersons')}</p>
  );
}
