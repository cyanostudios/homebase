import { ChevronDown, ChevronRight, Edit, Plus, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import { useGarments } from '../hooks/useGarments';
import type { GarmentCheckboxColumn, GarmentList, GarmentPerson } from '../types/garments';
import {
  findDuplicateJerseyNumbers,
  getMasterCheckboxState,
  getPersonCompletionStatus,
  personCompletionDotClass,
  personsWithEditingJersey,
  setCheckboxValuesForIds,
  toggleCheckboxValue,
} from '../utils/garmentListFilter';
import {
  sizeFieldForGroup,
  translateCheckboxColumnLabel,
  translateCheckboxGroupLabel,
  translateCheckboxStatusLabel,
  type GarmentSizeField,
} from '../utils/checkboxColumnI18n';

import { PersonBlock } from './PersonBlock';

function splitMatrixColumns(columns: GarmentCheckboxColumn[]): {
  personColumns: GarmentCheckboxColumn[];
  garmentGroups: Array<{ group: string; columns: GarmentCheckboxColumn[] }>;
  /** Shared clothing status headers (Ordered / Delivered / Handed out). */
  statusLabels: string[];
} {
  const personColumns: GarmentCheckboxColumn[] = [];
  const garmentGroups: Array<{ group: string; columns: GarmentCheckboxColumn[] }> = [];
  const indexByGroup = new Map<string, number>();

  for (const col of columns) {
    const group = col.group?.trim() || '';
    if (!group) {
      personColumns.push(col);
      continue;
    }
    const existing = indexByGroup.get(group);
    if (existing == null) {
      indexByGroup.set(group, garmentGroups.length);
      garmentGroups.push({ group, columns: [col] });
    } else {
      garmentGroups[existing].columns.push(col);
    }
  }

  const statusLabels =
    garmentGroups[0]?.columns.map((c) => c.label) ??
    Array.from(new Set(garmentGroups.flatMap((g) => g.columns.map((c) => c.label))));

  return { personColumns, garmentGroups, statusLabels };
}

function columnForStatus(
  groupColumns: GarmentCheckboxColumn[],
  statusLabel: string,
): GarmentCheckboxColumn | undefined {
  return groupColumns.find((c) => c.label === statusLabel);
}

function statusColumnIdsAcrossGroups(
  garmentGroups: Array<{ group: string; columns: GarmentCheckboxColumn[] }>,
  statusLabel: string,
): string[] {
  return garmentGroups
    .map(({ columns }) => columnForStatus(columns, statusLabel)?.id)
    .filter((id): id is string => Boolean(id));
}

function MasterStatusCheckbox({
  checked,
  indeterminate,
  disabled,
  ariaLabel,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer disabled:cursor-default"
    />
  );
}

export function PersonMatrix({
  list,
  readOnly = false,
}: {
  list: GarmentList;
  readOnly?: boolean;
  /** @deprecated Unused in spreadsheet layout; kept for call-site compatibility. */
  hideComment?: boolean;
}) {
  const { t } = useTranslation();
  const { addPerson, updatePerson, deletePerson } = useGarments();
  const persons = list.persons ?? [];
  const columns = [...(list.checkboxColumns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const checkboxColumnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const { personColumns, garmentGroups, statusLabels } = useMemo(
    () => splitMatrixColumns(columns),
    [columns],
  );

  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<GarmentPerson>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const duplicateJerseys = useMemo(() => {
    const forDup = personsWithEditingJersey(persons, editingId, editDraft.jerseyNumber);
    return findDuplicateJerseyNumbers(forDup);
  }, [persons, editingId, editDraft.jerseyNumber]);

  const toggleExpanded = (personId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

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
    setExpandedIds((prev) => new Set(prev).add(person.id));
  };

  const personFieldPayload = (person: GarmentPerson, overrides: Partial<GarmentPerson> = {}) => ({
    name: (overrides.name ?? person.name ?? '').trim(),
    shirtSize: overrides.shirtSize !== undefined ? overrides.shirtSize : person.shirtSize,
    shortsSize: overrides.shortsSize !== undefined ? overrides.shortsSize : person.shortsSize,
    socksSize: overrides.socksSize !== undefined ? overrides.socksSize : person.socksSize,
    jerseyNumber:
      overrides.jerseyNumber !== undefined ? overrides.jerseyNumber : person.jerseyNumber,
    jerseyName: overrides.jerseyName !== undefined ? overrides.jerseyName : person.jerseyName,
    initials: overrides.initials !== undefined ? overrides.initials : person.initials,
    comment: overrides.comment !== undefined ? overrides.comment : person.comment,
    checkboxValues:
      overrides.checkboxValues !== undefined ? overrides.checkboxValues : person.checkboxValues,
  });

  const saveEdit = async () => {
    if (!editingId) {
      return;
    }
    const person = persons.find((p) => p.id === editingId);
    if (!person) {
      return;
    }
    await updatePerson(
      list.id,
      editingId,
      personFieldPayload(person, {
        ...editDraft,
        name: (editDraft.name ?? '').trim(),
        jerseyName: (editDraft.jerseyName ?? '').trim() || null,
        initials: (editDraft.initials ?? '').trim() || null,
      }),
    );
    setEditingId(null);
  };

  const saveTextField = async (
    person: GarmentPerson,
    field: 'jerseyName' | 'initials' | GarmentSizeField,
    raw: string,
  ) => {
    if (readOnly) {
      return;
    }
    const next = raw.trim() || null;
    const current = person[field] ?? null;
    if (next === current) {
      return;
    }
    await updatePerson(list.id, person.id, personFieldPayload(person, { [field]: next }));
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
    await updatePerson(
      list.id,
      person.id,
      personFieldPayload(person, {
        checkboxValues: next,
        ...(editingThis
          ? {
              jerseyName: editDraft.jerseyName ?? person.jerseyName,
              initials: editDraft.initials ?? person.initials,
              name: editDraft.name ?? person.name,
            }
          : {}),
      }),
    );
  };

  const toggleMasterStatus = async (person: GarmentPerson, statusLabel: string) => {
    if (readOnly) {
      return;
    }
    const columnIds = statusColumnIdsAcrossGroups(garmentGroups, statusLabel);
    if (columnIds.length === 0) {
      return;
    }
    const editingThis = editingId === person.id;
    const currentValues = editingThis
      ? (editDraft.checkboxValues ?? person.checkboxValues)
      : person.checkboxValues;
    const master = getMasterCheckboxState(currentValues, columnIds);
    const nextChecked = !(master.checked && !master.indeterminate);
    const next = setCheckboxValuesForIds(currentValues, columnIds, nextChecked);
    if (editingThis) {
      setEditDraft((prev) => ({ ...prev, checkboxValues: next }));
    }
    await updatePerson(
      list.id,
      person.id,
      personFieldPayload(person, {
        checkboxValues: next,
        ...(editingThis
          ? {
              jerseyName: editDraft.jerseyName ?? person.jerseyName,
              initials: editDraft.initials ?? person.initials,
              name: editDraft.name ?? person.name,
            }
          : {}),
      }),
    );
  };

  const statusColCount = statusLabels.length;
  const showGarmentColumns = garmentGroups.length > 0 && statusColCount > 0;

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
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-10 border-r border-border bg-muted/30 px-3 py-2 text-left font-medium text-foreground">
                  {t('garments.personName')}
                </th>
                <th className="border-r border-border px-1.5 py-2 text-center text-[11px] font-medium leading-tight text-muted-foreground">
                  {t('garments.jerseyName')}
                </th>
                <th className="border-r border-border px-1.5 py-2 text-center text-[11px] font-medium leading-tight text-muted-foreground">
                  {t('garments.initials')}
                </th>
                {personColumns.map((col) => (
                  <th
                    key={col.id}
                    className="border-r border-border px-1.5 py-2 text-center text-[11px] font-medium leading-tight text-muted-foreground"
                    title={translateCheckboxColumnLabel(t, col)}
                  >
                    {translateCheckboxColumnLabel(t, col)}
                  </th>
                ))}
                {showGarmentColumns
                  ? statusLabels.map((label) => (
                      <th
                        key={label}
                        className="border-r border-border px-1.5 py-2 text-center text-[11px] font-medium leading-tight text-muted-foreground last:border-r-0"
                        title={translateCheckboxStatusLabel(t, label)}
                      >
                        {translateCheckboxStatusLabel(t, label)}
                      </th>
                    ))
                  : null}
                {!readOnly ? (
                  <th className="w-24 border-l border-border px-2 py-2 text-center text-[11px] font-medium leading-tight text-muted-foreground">
                    {t('garments.size')}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {persons.map((person) => {
                const isEditing = !readOnly && editingId === person.id;
                const isExpanded = expandedIds.has(person.id);
                const checkboxValues = isEditing
                  ? (editDraft.checkboxValues ?? person.checkboxValues ?? {})
                  : (person.checkboxValues ?? {});
                const jerseyDup = duplicateJerseys.has(person.id);
                const Chevron = isExpanded ? ChevronDown : ChevronRight;
                const completionStatus = getPersonCompletionStatus({
                  jerseyName: isEditing
                    ? (editDraft.jerseyName ?? person.jerseyName)
                    : person.jerseyName,
                  initials: isEditing ? (editDraft.initials ?? person.initials) : person.initials,
                  checkboxValues,
                  checkboxColumnIds,
                });
                const completionLabel =
                  completionStatus === 'complete'
                    ? t('garments.completionComplete')
                    : completionStatus === 'partial'
                      ? t('garments.completionPartial')
                      : t('garments.completionEmpty');

                return (
                  <React.Fragment key={person.id}>
                    <tr className="border-b border-border/60 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 border-r border-border bg-background px-1 py-1.5">
                        <div className="flex min-w-0 items-center gap-0.5">
                          {showGarmentColumns ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? t('garments.collapsePersonRow')
                                  : t('garments.expandPersonRow')
                              }
                              onClick={() => toggleExpanded(person.id)}
                            >
                              <Chevron className="h-4 w-4" />
                            </button>
                          ) : null}
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              personCompletionDotClass(completionStatus),
                            )}
                            title={completionLabel}
                            aria-label={completionLabel}
                          />
                          {isEditing ? (
                            <Input
                              value={editDraft.name ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, name: e.target.value }))
                              }
                              aria-label={t('garments.personName')}
                              className={cn(
                                'h-8 min-w-0 flex-1 text-sm',
                                jerseyDup && 'border-amber-400',
                              )}
                            />
                          ) : (
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate px-1 text-left text-sm font-medium hover:underline"
                              onClick={() => {
                                if (showGarmentColumns) {
                                  toggleExpanded(person.id);
                                }
                              }}
                            >
                              {person.name || '—'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-border/50 px-1 py-1.5">
                        {readOnly ? (
                          <span className="block truncate px-1 text-xs">
                            {person.jerseyName?.trim() || '—'}
                          </span>
                        ) : isEditing ? (
                          <Input
                            value={editDraft.jerseyName ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, jerseyName: e.target.value }))
                            }
                            aria-label={t('garments.jerseyName')}
                            className="h-8 text-xs"
                          />
                        ) : (
                          <Input
                            defaultValue={person.jerseyName ?? ''}
                            key={`${person.id}-jerseyName-${person.jerseyName ?? ''}`}
                            onBlur={(e) => void saveTextField(person, 'jerseyName', e.target.value)}
                            aria-label={t('garments.jerseyName')}
                            className="h-8 text-xs"
                          />
                        )}
                      </td>
                      <td className="border-r border-border/50 px-1 py-1.5">
                        {readOnly ? (
                          <span className="block truncate px-1 text-xs">
                            {person.initials?.trim() || '—'}
                          </span>
                        ) : isEditing ? (
                          <Input
                            value={editDraft.initials ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, initials: e.target.value }))
                            }
                            aria-label={t('garments.initials')}
                            className="h-8 w-16 text-xs"
                          />
                        ) : (
                          <Input
                            defaultValue={person.initials ?? ''}
                            key={`${person.id}-initials-${person.initials ?? ''}`}
                            onBlur={(e) => void saveTextField(person, 'initials', e.target.value)}
                            aria-label={t('garments.initials')}
                            className="h-8 w-16 text-xs"
                          />
                        )}
                      </td>
                      {personColumns.map((col) => (
                        <td
                          key={col.id}
                          className="border-r border-border/50 px-1 py-1.5 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(checkboxValues[col.id])}
                            disabled={readOnly}
                            onChange={() => void toggleCheckbox(person, col.id)}
                            aria-label={`${person.name} — ${translateCheckboxColumnLabel(t, col)}`}
                            className="h-4 w-4 cursor-pointer disabled:cursor-default"
                          />
                        </td>
                      ))}
                      {showGarmentColumns
                        ? statusLabels.map((label) => {
                            const columnIds = statusColumnIdsAcrossGroups(garmentGroups, label);
                            const master = getMasterCheckboxState(checkboxValues, columnIds);
                            return (
                              <td
                                key={`${person.id}-parent-${label}`}
                                className="border-r border-border/50 px-1 py-1.5 text-center"
                              >
                                <MasterStatusCheckbox
                                  checked={master.checked}
                                  indeterminate={master.indeterminate}
                                  disabled={readOnly}
                                  ariaLabel={`${person.name} — ${translateCheckboxStatusLabel(t, label)} (${t('garments.allGarments')})`}
                                  onToggle={() => void toggleMasterStatus(person, label)}
                                />
                              </td>
                            );
                          })
                        : null}
                      {!readOnly ? (
                        <td className="px-1 py-1.5">
                          {isEditing ? (
                            <div className="inline-flex gap-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                className="h-7 px-2 text-xs"
                                onClick={() => void saveEdit()}
                              >
                                {t('common.save')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-1.5"
                                icon={X}
                                aria-label={t('common.cancel')}
                                onClick={() => setEditingId(null)}
                              />
                            </div>
                          ) : (
                            <div className="inline-flex gap-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-1.5"
                                icon={Edit}
                                aria-label={t('common.edit')}
                                onClick={() => startEdit(person)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-1.5 text-red-600"
                                icon={Trash2}
                                aria-label={t('common.delete')}
                                onClick={() => setDeletingId(person.id)}
                              />
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>

                    {isExpanded && showGarmentColumns
                      ? garmentGroups.map(({ group, columns: groupCols }) => {
                          const sizeField = sizeFieldForGroup(group);
                          const sizeValue = sizeField ? (person[sizeField] ?? '') : '';
                          return (
                            <tr
                              key={`${person.id}-${group}`}
                              className="border-b border-border/40 bg-muted/10"
                            >
                              <td className="sticky left-0 z-10 border-r border-border bg-muted/10 py-1.5 pl-9 pr-2 text-xs text-muted-foreground">
                                {translateCheckboxGroupLabel(t, group)}
                              </td>
                              <td className="border-r border-border/40 px-1 py-1.5" />
                              <td className="border-r border-border/40 px-1 py-1.5" />
                              {personColumns.map((col) => (
                                <td
                                  key={`${person.id}-${group}-${col.id}`}
                                  className="border-r border-border/40 px-1 py-1.5"
                                />
                              ))}
                              {statusLabels.map((statusLabel) => {
                                const col = columnForStatus(groupCols, statusLabel);
                                if (!col) {
                                  return (
                                    <td
                                      key={`${person.id}-${group}-${statusLabel}`}
                                      className="border-r border-border/40 px-1 py-1.5"
                                    />
                                  );
                                }
                                return (
                                  <td
                                    key={`${person.id}-${group}-${col.id}`}
                                    className="border-r border-border/40 px-1 py-1.5 text-center"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(checkboxValues[col.id])}
                                      disabled={readOnly}
                                      onChange={() => void toggleCheckbox(person, col.id)}
                                      aria-label={`${person.name} — ${translateCheckboxGroupLabel(t, group)} ${translateCheckboxColumnLabel(t, col)}`}
                                      className="h-4 w-4 cursor-pointer disabled:cursor-default"
                                    />
                                  </td>
                                );
                              })}
                              {!readOnly ? (
                                <td className="px-1 py-1.5">
                                  {sizeField ? (
                                    <Input
                                      defaultValue={sizeValue}
                                      key={`${person.id}-${sizeField}-${sizeValue}`}
                                      onBlur={(e) =>
                                        void saveTextField(person, sizeField, e.target.value)
                                      }
                                      aria-label={`${person.name} — ${translateCheckboxGroupLabel(t, group)} ${t('garments.size')}`}
                                      placeholder={t('garments.sizePlaceholder')}
                                      className="h-8 w-full min-w-[3.5rem] text-xs"
                                    />
                                  ) : null}
                                </td>
                              ) : null}
                            </tr>
                          );
                        })
                      : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
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
