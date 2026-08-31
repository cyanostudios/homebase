import { Check, ChevronDown, ChevronRight, Edit, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItemCompact,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { nextListTableSort } from '@/core/list/listViewMode';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DETAIL_FIELD_LABEL_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListTableSortIcon } from '@/core/ui/ListColumnLayoutToggle';
import { cn } from '@/lib/utils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { Team } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type {
  GarmentCheckboxColumn,
  GarmentList,
  GarmentPerson,
  InventoryItem,
} from '../types/garments';
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
  translateCheckboxColumnLabel,
  translateCheckboxGroupLabel,
  translateCheckboxStatusLabel,
  type GarmentSizeField,
} from '../utils/checkboxColumnI18n';
import {
  filterMatrixColumns,
  inventoryItemAudiences,
  inventoryItemIdFromGroupColumns,
  inventoryItemSizes,
  inventoryItemSizesForAudience,
  personHasFilledInventoryItem,
  resolveMatrixColumns,
} from '../utils/inventoryListColumns';
import { MATRIX_TABLE_SCROLL_CLASS } from '../utils/variantListStyles';

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

/** Person-level checkbox columns — width follows the header label (single line). */
const PERSON_CHECKBOX_COL_CLASS =
  'whitespace-nowrap border-r border-border px-2 py-2 text-center text-xs font-black leading-tight text-slate-400 dark:text-slate-500';

/** Garment status master columns — width follows the header label (single line). */
const STATUS_CHECKBOX_COL_CLASS =
  'whitespace-nowrap border-r border-border px-2.5 py-2 text-center text-xs font-black leading-tight text-slate-400 dark:text-slate-500';

const PERSON_CHECKBOX_CELL_CLASS = 'border-r border-border/50 px-2 py-1.5 text-center';
const STATUS_CHECKBOX_CELL_CLASS = 'border-r border-border/50 px-2.5 py-1.5 text-center';

/** Compact matrix selects — narrow trigger, primary text when a value is chosen. */
const MATRIX_SELECT_TRIGGER_CLASS =
  'h-7 w-full min-w-0 border-border/60 px-1.5 text-xs shadow-none [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40';
const MATRIX_SELECT_CONTENT_CLASS = 'min-w-[var(--radix-select-trigger-width)] p-0.5';

function matrixSelectTriggerClass(hasValue: boolean): string {
  return cn(MATRIX_SELECT_TRIGGER_CLASS, hasValue && '[&>span]:font-medium [&>span]:text-primary');
}

type PersonMatrixSortField = 'name' | 'team' | 'jerseyNumber';

const MATRIX_HEADER_BASE = 'text-xs font-black leading-tight text-slate-400 dark:text-slate-500';

function isPersonMatrixAscDefault(field: PersonMatrixSortField): boolean {
  return field === 'name' || field === 'team' || field === 'jerseyNumber';
}

function personTeamSortLabel(person: GarmentPerson, teams: Team[]): string {
  if (person.teamId == null || person.teamId === '') {
    return '';
  }
  const team = teams.find((entry) => String(entry.id) === String(person.teamId));
  if (!team) {
    return String(person.teamId);
  }
  return (formatTeamLabel(team) || team.name || '').trim();
}

function comparePersonsByField(
  a: GarmentPerson,
  b: GarmentPerson,
  field: PersonMatrixSortField,
  order: 'asc' | 'desc',
  teams: Team[] = [],
): number {
  const av =
    field === 'name'
      ? String(a.name ?? '')
      : field === 'team'
        ? personTeamSortLabel(a, teams)
        : String(a.jerseyNumber ?? '');
  const bv =
    field === 'name'
      ? String(b.name ?? '')
      : field === 'team'
        ? personTeamSortLabel(b, teams)
        : String(b.jerseyNumber ?? '');

  // Empty team sorts last in both directions (stable “no team” bucket).
  if (field === 'team') {
    const aEmpty = !av;
    const bEmpty = !bv;
    if (aEmpty !== bEmpty) {
      return aEmpty ? 1 : -1;
    }
  }

  const res = av
    .toLowerCase()
    .localeCompare(bv.toLowerCase(), undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? res : -res;
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
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onChange={onToggle}
      aria-label={ariaLabel}
      className={CHECKBOX_SM_CLASS}
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
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const {
    addPerson,
    updatePerson,
    deletePerson,
    inventoryItems,
    updatePersonCtSizes,
    openGarmentsInventory,
  } = useGarments();
  const persons = list.persons ?? [];
  const columns = useMemo(() => resolveMatrixColumns(list, inventoryItems), [list, inventoryItems]);
  const checkboxColumnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const { personColumns, garmentGroups, statusLabels } = useMemo(
    () => splitMatrixColumns(columns),
    [columns],
  );
  const statusColCount = statusLabels.length;
  const showGarmentColumns = garmentGroups.length > 0 && statusColCount > 0;
  const showAudienceColumn = useMemo(() => {
    if (!showGarmentColumns) {
      return false;
    }
    return garmentGroups.some(({ columns: groupCols }) => {
      const inventoryItemId = inventoryItemIdFromGroupColumns(groupCols);
      const inventoryItem = inventoryItemId
        ? inventoryItems.find((item) => String(item.id) === inventoryItemId)
        : undefined;
      return inventoryItemAudiences(inventoryItem).length > 0;
    });
  }, [garmentGroups, inventoryItems, showGarmentColumns]);

  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<GarmentPerson>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [primarySort, setPrimarySort] = useState<PersonMatrixSortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => comparePersonsByField(a, b, primarySort, sortOrder, teams)),
    [persons, primarySort, sortOrder, teams],
  );

  const handleHeaderSort = useCallback(
    (field: PersonMatrixSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isPersonMatrixAscDefault);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

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
    teamId: overrides.teamId !== undefined ? overrides.teamId : person.teamId,
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
        jerseyNumber: (editDraft.jerseyNumber ?? '').trim() || null,
        jerseyName: (editDraft.jerseyName ?? '').trim() || null,
        initials: (editDraft.initials ?? '').trim() || null,
      }),
    );
    setEditingId(null);
  };

  const saveTextField = async (
    person: GarmentPerson,
    field: 'jerseyName' | 'jerseyNumber' | 'initials' | GarmentSizeField,
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

  const saveTeamField = async (person: GarmentPerson, nextTeamId: string | null) => {
    if (readOnly) {
      return;
    }
    const current = person.teamId ?? null;
    if (nextTeamId === current) {
      return;
    }
    await updatePerson(list.id, person.id, personFieldPayload(person, { teamId: nextTeamId }));
  };

  const saveCtSize = async (person: GarmentPerson, itemId: string, raw: string) => {
    if (readOnly) {
      return;
    }
    const next = raw.trim();
    const current = person.ctSizes?.[itemId] ?? '';
    if (next === current) {
      return;
    }
    const nextSizes = { ...(person.ctSizes ?? {}) };
    if (next) {
      nextSizes[itemId] = next;
    } else {
      delete nextSizes[itemId];
    }
    await updatePersonCtSizes(list.id, person.id, { ctSizes: nextSizes });
  };

  const saveCtAudience = async (
    person: GarmentPerson,
    itemId: string,
    inventoryItem: InventoryItem | undefined,
    raw: string,
  ) => {
    if (readOnly) {
      return;
    }
    const next = raw.trim();
    const current = person.ctAudiences?.[itemId] ?? '';
    if (next === current) {
      return;
    }
    const nextAudiences = { ...(person.ctAudiences ?? {}) };
    if (next) {
      nextAudiences[itemId] = next;
    } else {
      delete nextAudiences[itemId];
    }
    const nextSizes = { ...(person.ctSizes ?? {}) };
    const currentSize = nextSizes[itemId] ?? '';
    if (currentSize) {
      const allowed = inventoryItemSizesForAudience(inventoryItem, next);
      if (!allowed.includes(currentSize)) {
        delete nextSizes[itemId];
      }
    }
    await updatePersonCtSizes(list.id, person.id, {
      ctAudiences: nextAudiences,
      ctSizes: nextSizes,
    });
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

  return (
    <div className="min-w-0 space-y-3">
      {duplicateJerseys.size > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('garments.jerseyDuplicateWarning')}
        </div>
      ) : null}

      {!readOnly && persons.length > 0 && !showGarmentColumns ? (
        <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <p>{t('garments.assignInventoryHint')}</p>
          <button
            type="button"
            className="mt-2 font-medium text-primary hover:underline"
            onClick={() => openGarmentsInventory()}
          >
            {t('garments.openGarmentsInventory')}
          </button>
        </div>
      ) : null}

      {persons.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('garments.noPersons')}</p>
      ) : (
        <div className={MATRIX_TABLE_SCROLL_CLASS}>
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-primary/5">
                <th
                  className={cn(
                    'border-r border-border bg-primary/5 px-3 py-2 text-left',
                    MATRIX_HEADER_BASE,
                    'cursor-pointer select-none hover:bg-primary/10',
                  )}
                  onClick={() => handleHeaderSort('name')}
                  aria-sort={
                    primarySort === 'name'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex items-center gap-2 leading-4">
                    <span>{t('garments.personName')}</span>
                    <ListTableSortIcon active={primarySort === 'name'} order={sortOrder} />
                  </div>
                </th>
                {hasTeams ? (
                  <th
                    className={cn(
                      'min-w-[8rem] border-r border-border px-1.5 py-2 text-left',
                      MATRIX_HEADER_BASE,
                      'cursor-pointer select-none hover:bg-primary/10',
                    )}
                    onClick={() => handleHeaderSort('team')}
                    aria-sort={
                      primarySort === 'team'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <div className="flex items-center gap-2 leading-4">
                      <span>{t('garments.team')}</span>
                      <ListTableSortIcon active={primarySort === 'team'} order={sortOrder} />
                    </div>
                  </th>
                ) : null}
                <th
                  className={cn(
                    'border-r border-border px-1.5 py-2 text-center',
                    MATRIX_HEADER_BASE,
                  )}
                >
                  {t('garments.jerseyName')}
                </th>
                <th
                  className={cn(
                    'w-11 border-r border-border px-0.5 py-2 text-center',
                    MATRIX_HEADER_BASE,
                  )}
                >
                  {t('garments.initials')}
                </th>
                <th
                  className={cn(
                    'w-12 border-r border-border px-0.5 py-2 text-center',
                    MATRIX_HEADER_BASE,
                    'cursor-pointer select-none hover:bg-primary/10',
                  )}
                  onClick={() => handleHeaderSort('jerseyNumber')}
                  aria-sort={
                    primarySort === 'jerseyNumber'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex items-center justify-center gap-1 leading-4">
                    <span>{t('garments.jerseyNumber')}</span>
                    <ListTableSortIcon active={primarySort === 'jerseyNumber'} order={sortOrder} />
                  </div>
                </th>
                {personColumns.map((col) => (
                  <th
                    key={col.id}
                    className={PERSON_CHECKBOX_COL_CLASS}
                    title={translateCheckboxColumnLabel(t, col)}
                  >
                    {translateCheckboxColumnLabel(t, col)}
                  </th>
                ))}
                {showGarmentColumns
                  ? statusLabels.map((label) => (
                      <th
                        key={label}
                        className={cn(STATUS_CHECKBOX_COL_CLASS, 'last:border-r-0')}
                        title={translateCheckboxStatusLabel(t, label)}
                      >
                        {translateCheckboxStatusLabel(t, label)}
                      </th>
                    ))
                  : null}
                {!readOnly && showGarmentColumns ? (
                  <>
                    {showAudienceColumn ? (
                      <th
                        className={cn(
                          'w-16 border-l border-border px-1 py-2 text-center',
                          MATRIX_HEADER_BASE,
                        )}
                      >
                        {t('garments.audience')}
                      </th>
                    ) : null}
                    <th
                      className={cn(
                        'w-14 border-l border-border px-1 py-2 text-center',
                        MATRIX_HEADER_BASE,
                      )}
                    >
                      {t('garments.size')}
                    </th>
                  </>
                ) : null}
                {!readOnly ? (
                  <th
                    className={cn(
                      'w-[4.5rem] border-l border-border px-1 py-2 text-center',
                      MATRIX_HEADER_BASE,
                    )}
                  >
                    <span className="sr-only">{t('common.headerActions')}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sortedPersons.map((person) => {
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
                      <td className="border-r border-border bg-background px-1 py-1.5">
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
                      {hasTeams ? (
                        <td className="min-w-[8rem] border-r border-border/50 px-1 py-1.5">
                          {readOnly ? (
                            <span className="block truncate px-1 text-xs">
                              {(() => {
                                const team = person.teamId
                                  ? teams.find(
                                      (entry) => String(entry.id) === String(person.teamId),
                                    )
                                  : null;
                                return team ? formatTeamLabel(team) || team.name : '—';
                              })()}
                            </span>
                          ) : isEditing ? (
                            <Select
                              value={editDraft.teamId ?? '__none__'}
                              onValueChange={(value) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  teamId: value === '__none__' ? null : value,
                                }))
                              }
                            >
                              <SelectTrigger
                                aria-label={t('garments.team')}
                                className="h-8 text-xs"
                              >
                                <SelectValue placeholder={t('garments.teamNone')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItemCompact value="__none__">
                                  {t('garments.teamNone')}
                                </SelectItemCompact>
                                {teams.map((team) => (
                                  <SelectItemCompact key={team.id} value={String(team.id)}>
                                    {formatTeamLabel(team)}
                                  </SelectItemCompact>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select
                              value={person.teamId ?? '__none__'}
                              onValueChange={(value) =>
                                void saveTeamField(person, value === '__none__' ? null : value)
                              }
                            >
                              <SelectTrigger
                                aria-label={`${person.name} — ${t('garments.team')}`}
                                className="h-8 text-xs"
                              >
                                <SelectValue placeholder={t('garments.teamNone')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItemCompact value="__none__">
                                  {t('garments.teamNone')}
                                </SelectItemCompact>
                                {teams.map((team) => (
                                  <SelectItemCompact key={team.id} value={String(team.id)}>
                                    {formatTeamLabel(team)}
                                  </SelectItemCompact>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      ) : null}
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
                      <td className="w-11 border-r border-border/50 px-0.5 py-1.5">
                        {readOnly ? (
                          <span className="block truncate px-0.5 text-center text-xs">
                            {person.initials?.trim() || '—'}
                          </span>
                        ) : isEditing ? (
                          <Input
                            value={editDraft.initials ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, initials: e.target.value }))
                            }
                            aria-label={t('garments.initials')}
                            className="h-8 w-full px-1 text-center text-xs"
                          />
                        ) : (
                          <Input
                            defaultValue={person.initials ?? ''}
                            key={`${person.id}-initials-${person.initials ?? ''}`}
                            onBlur={(e) => void saveTextField(person, 'initials', e.target.value)}
                            aria-label={t('garments.initials')}
                            className="h-8 w-full px-1 text-center text-xs"
                          />
                        )}
                      </td>
                      <td className="w-12 border-r border-border/50 px-0.5 py-1.5">
                        {readOnly ? (
                          <span
                            className={cn(
                              'block truncate px-0.5 text-center text-xs font-medium',
                              jerseyDup && 'text-amber-700 dark:text-amber-300',
                            )}
                          >
                            {person.jerseyNumber?.trim() || '—'}
                          </span>
                        ) : isEditing ? (
                          <Input
                            value={editDraft.jerseyNumber ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, jerseyNumber: e.target.value }))
                            }
                            aria-label={t('garments.jerseyNumber')}
                            className={cn(
                              'h-8 w-full px-1 text-center text-xs',
                              jerseyDup && 'border-amber-400',
                            )}
                          />
                        ) : (
                          <Input
                            defaultValue={person.jerseyNumber ?? ''}
                            key={`${person.id}-jerseyNumber-${person.jerseyNumber ?? ''}`}
                            onBlur={(e) =>
                              void saveTextField(person, 'jerseyNumber', e.target.value)
                            }
                            aria-label={t('garments.jerseyNumber')}
                            className={cn(
                              'h-8 w-full px-1 text-center text-xs',
                              jerseyDup && 'border-amber-400',
                            )}
                          />
                        )}
                      </td>
                      {personColumns.map((col) => (
                        <td key={col.id} className={PERSON_CHECKBOX_CELL_CLASS}>
                          <input
                            type="checkbox"
                            checked={Boolean(checkboxValues[col.id])}
                            disabled={readOnly}
                            onChange={() => void toggleCheckbox(person, col.id)}
                            aria-label={`${person.name} — ${translateCheckboxColumnLabel(t, col)}`}
                            className={cn(
                              CHECKBOX_SM_CLASS,
                              'cursor-pointer disabled:cursor-default',
                            )}
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
                                className={STATUS_CHECKBOX_CELL_CLASS}
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
                      {!readOnly && showGarmentColumns ? (
                        <>
                          {showAudienceColumn ? (
                            <td className="border-l border-border/50 px-1 py-1.5" />
                          ) : null}
                          <td className="border-l border-border/50 px-1 py-1.5" />
                        </>
                      ) : null}
                      {!readOnly ? (
                        <td className="border-l border-border/50 px-1 py-1.5">
                          {isEditing ? (
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <RoundIconLabelButton
                                type="button"
                                size="xs"
                                icon={Check}
                                label={t('common.save')}
                                variant="soft"
                                expandOnHover={false}
                                onClick={() => void saveEdit()}
                              />
                              <RoundIconLabelButton
                                type="button"
                                size="xs"
                                icon={X}
                                label={t('common.cancel')}
                                variant="secondary"
                                expandOnHover={false}
                                onClick={() => setEditingId(null)}
                              />
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <RoundIconLabelButton
                                type="button"
                                size="xs"
                                icon={Edit}
                                label={t('common.edit')}
                                variant="soft"
                                expandOnHover={false}
                                onClick={() => startEdit(person)}
                              />
                              <RoundIconLabelButton
                                type="button"
                                size="xs"
                                icon={Trash2}
                                label={t('common.delete')}
                                variant="dangerSoft"
                                expandOnHover={false}
                                onClick={() => setDeletingId(person.id)}
                              />
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>

                    {isExpanded && showGarmentColumns
                      ? garmentGroups.map(({ group, columns: groupCols }) => {
                          const inventoryItemId = inventoryItemIdFromGroupColumns(groupCols);
                          const inventoryItem = inventoryItemId
                            ? inventoryItems.find((item) => String(item.id) === inventoryItemId)
                            : undefined;
                          const presetAudiences = inventoryItem
                            ? inventoryItemAudiences(inventoryItem)
                            : [];
                          const ctAudienceValue = inventoryItemId
                            ? (person.ctAudiences?.[inventoryItemId] ?? '')
                            : '';
                          const effectiveAudience =
                            ctAudienceValue ||
                            (presetAudiences.length === 1 ? presetAudiences[0] : '');
                          const presetSizes = inventoryItem
                            ? presetAudiences.length > 0
                              ? inventoryItemSizesForAudience(inventoryItem, effectiveAudience)
                              : inventoryItemSizes(inventoryItem)
                            : [];
                          const ctSizeValue = inventoryItemId
                            ? (person.ctSizes?.[inventoryItemId] ?? '')
                            : '';
                          const sizeSelectDisabled =
                            presetAudiences.length > 1 && !effectiveAudience;
                          return (
                            <tr
                              key={`${person.id}-${group}`}
                              className="border-b border-border/40 bg-muted/10"
                            >
                              <td className="border-r border-border bg-muted/10 py-1.5 pl-9 pr-2 text-xs text-muted-foreground">
                                {translateCheckboxGroupLabel(t, group)}
                              </td>
                              {hasTeams ? (
                                <td className="border-r border-border/40 px-1 py-1.5" />
                              ) : null}
                              <td className="border-r border-border/40 px-1 py-1.5" />
                              <td className="border-r border-border/40 px-0.5 py-1.5" />
                              <td className="border-r border-border/40 px-0.5 py-1.5" />
                              {personColumns.map((col) => (
                                <td
                                  key={`${person.id}-${group}-${col.id}`}
                                  className={cn(PERSON_CHECKBOX_CELL_CLASS, 'border-border/40')}
                                />
                              ))}
                              {statusLabels.map((statusLabel) => {
                                const col = columnForStatus(groupCols, statusLabel);
                                if (!col) {
                                  return (
                                    <td
                                      key={`${person.id}-${group}-${statusLabel}`}
                                      className={cn(STATUS_CHECKBOX_CELL_CLASS, 'border-border/40')}
                                    />
                                  );
                                }
                                return (
                                  <td
                                    key={`${person.id}-${group}-${col.id}`}
                                    className={cn(STATUS_CHECKBOX_CELL_CLASS, 'border-border/40')}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(checkboxValues[col.id])}
                                      disabled={readOnly}
                                      onChange={() => void toggleCheckbox(person, col.id)}
                                      aria-label={`${person.name} — ${translateCheckboxGroupLabel(t, group)} ${translateCheckboxColumnLabel(t, col)}`}
                                      className={cn(
                                        CHECKBOX_SM_CLASS,
                                        'cursor-pointer disabled:cursor-default',
                                      )}
                                    />
                                  </td>
                                );
                              })}
                              {!readOnly && showGarmentColumns ? (
                                <>
                                  {showAudienceColumn ? (
                                    <td className="border-l border-border/40 px-0.5 py-1.5">
                                      {inventoryItemId && presetAudiences.length > 0 ? (
                                        <Select
                                          value={ctAudienceValue || '__none__'}
                                          onValueChange={(value) =>
                                            void saveCtAudience(
                                              person,
                                              inventoryItemId,
                                              inventoryItem,
                                              value === '__none__' ? '' : value,
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            aria-label={`${person.name} — ${group} ${t('garments.audience')}`}
                                            className={matrixSelectTriggerClass(
                                              Boolean(ctAudienceValue),
                                            )}
                                          >
                                            <SelectValue
                                              placeholder={t('garments.audiencePlaceholder')}
                                            />
                                          </SelectTrigger>
                                          <SelectContent className={MATRIX_SELECT_CONTENT_CLASS}>
                                            <SelectItemCompact value="__none__">
                                              —
                                            </SelectItemCompact>
                                            {presetAudiences.map((audience) => (
                                              <SelectItemCompact key={audience} value={audience}>
                                                {audience}
                                              </SelectItemCompact>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : null}
                                    </td>
                                  ) : null}
                                  <td className="border-l border-border/40 px-0.5 py-1.5">
                                    {inventoryItemId ? (
                                      presetSizes.length > 0 ? (
                                        <Select
                                          value={ctSizeValue || '__none__'}
                                          disabled={sizeSelectDisabled}
                                          onValueChange={(value) =>
                                            void saveCtSize(
                                              person,
                                              inventoryItemId,
                                              value === '__none__' ? '' : value,
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            aria-label={`${person.name} — ${group} ${t('garments.size')}`}
                                            className={matrixSelectTriggerClass(
                                              Boolean(ctSizeValue),
                                            )}
                                          >
                                            <SelectValue
                                              placeholder={t('garments.sizePlaceholder')}
                                            />
                                          </SelectTrigger>
                                          <SelectContent className={MATRIX_SELECT_CONTENT_CLASS}>
                                            <SelectItemCompact value="__none__">
                                              —
                                            </SelectItemCompact>
                                            {presetSizes.map((size) => (
                                              <SelectItemCompact key={size} value={size}>
                                                {size}
                                              </SelectItemCompact>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          defaultValue={ctSizeValue}
                                          key={`${person.id}-${inventoryItemId}-${effectiveAudience}-${ctSizeValue}`}
                                          disabled={sizeSelectDisabled}
                                          onBlur={(e) =>
                                            void saveCtSize(person, inventoryItemId, e.target.value)
                                          }
                                          aria-label={`${person.name} — ${group} ${t('garments.size')}`}
                                          placeholder={t('garments.sizePlaceholder')}
                                          className="h-8 w-full min-w-[3.5rem] text-xs"
                                        />
                                      )
                                    ) : null}
                                  </td>
                                </>
                              ) : null}
                              {!readOnly ? (
                                <td className="border-l border-border/40 px-1 py-1.5" />
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
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/50 pt-4">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="add-person-name" className={DETAIL_FIELD_LABEL_CLASS}>
              {t('garments.addPerson')}
            </Label>
            <Input
              id="add-person-name"
              name="garment-person-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder={t('garments.personNamePlaceholder')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-9"
            />
          </div>
          <RoundIconLabelButton
            type="button"
            icon={Plus}
            label={t('garments.addPerson')}
            variant="soft"
            size="xs"
            alwaysExpanded
            onClick={() => void handleAdd()}
            disabled={!draftName.trim()}
          />
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
  const { t } = useTranslation();
  const persons = list.persons ?? [];
  const columns = useMemo(
    () =>
      filterMatrixColumns(
        [...(list.checkboxColumns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
        list.assignedInventoryItemIds,
      ),
    [list.checkboxColumns, list.assignedInventoryItemIds],
  );
  const { personColumns, garmentGroups, statusLabels } = useMemo(
    () => splitMatrixColumns(columns),
    [columns],
  );
  const showGarmentColumns = garmentGroups.length > 0 && statusLabels.length > 0;
  const showAudienceColumn = useMemo(() => {
    if (!showGarmentColumns) {
      return false;
    }
    // Public payload has no inventory catalog; show Audience when any person has a value.
    return persons.some((person) =>
      Object.values(person.ctAudiences ?? {}).some((value) => Boolean(value?.trim())),
    );
  }, [persons, showGarmentColumns]);

  if (persons.length === 0) {
    return <PublicEmptyPersons />;
  }

  return (
    <div className={MATRIX_TABLE_SCROLL_CLASS}>
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-primary/5">
            <th
              className={cn(
                'border-r border-border bg-primary/5 px-3 py-2 text-left',
                MATRIX_HEADER_BASE,
              )}
            >
              {t('garments.personName')}
            </th>
            <th
              className={cn('border-r border-border px-1.5 py-2 text-center', MATRIX_HEADER_BASE)}
            >
              {t('garments.jerseyName')}
            </th>
            <th
              className={cn(
                'w-11 border-r border-border px-0.5 py-2 text-center',
                MATRIX_HEADER_BASE,
              )}
            >
              {t('garments.initials')}
            </th>
            {personColumns.map((col) => (
              <th
                key={col.id}
                className={PERSON_CHECKBOX_COL_CLASS}
                title={translateCheckboxColumnLabel(t, col)}
              >
                {translateCheckboxColumnLabel(t, col)}
              </th>
            ))}
            {showGarmentColumns
              ? statusLabels.map((label) => (
                  <th
                    key={label}
                    className={cn(STATUS_CHECKBOX_COL_CLASS, 'last:border-r-0')}
                    title={translateCheckboxStatusLabel(t, label)}
                  >
                    {translateCheckboxStatusLabel(t, label)}
                  </th>
                ))
              : null}
            {showGarmentColumns ? (
              <>
                {showAudienceColumn ? (
                  <th
                    className={cn(
                      'w-16 border-l border-border px-1 py-2 text-center',
                      MATRIX_HEADER_BASE,
                    )}
                  >
                    {t('garments.audience')}
                  </th>
                ) : null}
                <th
                  className={cn(
                    'w-14 border-l border-border px-1 py-2 text-center',
                    MATRIX_HEADER_BASE,
                  )}
                >
                  {t('garments.size')}
                </th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {persons.map((person) => {
            const checkboxValues = person.checkboxValues ?? {};
            const filledGroups = showGarmentColumns
              ? garmentGroups.filter(({ columns: groupCols }) => {
                  const itemId = inventoryItemIdFromGroupColumns(groupCols);
                  return itemId ? personHasFilledInventoryItem(person, itemId, groupCols) : false;
                })
              : [];

            return (
              <React.Fragment key={person.id}>
                <tr className="border-b border-border/60">
                  <td className="border-r border-border bg-background px-3 py-1.5 text-sm font-medium">
                    {person.name || '—'}
                  </td>
                  <td className="border-r border-border/50 px-1 py-1.5 text-center text-xs">
                    {person.jerseyName?.trim() || '—'}
                  </td>
                  <td className="w-11 border-r border-border/50 px-0.5 py-1.5 text-center text-xs">
                    {person.initials?.trim() || '—'}
                  </td>
                  {personColumns.map((col) => (
                    <td key={col.id} className={PERSON_CHECKBOX_CELL_CLASS}>
                      <input
                        type="checkbox"
                        checked={Boolean(checkboxValues[col.id])}
                        disabled
                        readOnly
                        aria-label={`${person.name} — ${translateCheckboxColumnLabel(t, col)}`}
                        className={cn(CHECKBOX_SM_CLASS, 'cursor-default')}
                      />
                    </td>
                  ))}
                  {showGarmentColumns
                    ? statusLabels.map((label) => (
                        <td
                          key={`${person.id}-parent-${label}`}
                          className={STATUS_CHECKBOX_CELL_CLASS}
                        />
                      ))
                    : null}
                  {showGarmentColumns ? (
                    <>
                      {showAudienceColumn ? (
                        <td className="border-l border-border/50 px-1 py-1.5" />
                      ) : null}
                      <td className="border-l border-border/50 px-1 py-1.5" />
                    </>
                  ) : null}
                </tr>
                {filledGroups.map(({ group, columns: groupCols }) => {
                  const inventoryItemId = inventoryItemIdFromGroupColumns(groupCols);
                  const audience =
                    inventoryItemId != null
                      ? (person.ctAudiences?.[inventoryItemId] ?? '').trim()
                      : '';
                  const size =
                    inventoryItemId != null ? (person.ctSizes?.[inventoryItemId] ?? '').trim() : '';
                  return (
                    <tr
                      key={`${person.id}-${group}`}
                      className="border-b border-border/40 bg-muted/10"
                    >
                      <td className="border-r border-border bg-muted/10 py-1.5 pl-9 pr-2 text-xs text-muted-foreground">
                        {translateCheckboxGroupLabel(t, group)}
                      </td>
                      <td className="border-r border-border/40 px-1 py-1.5" />
                      <td className="border-r border-border/40 px-0.5 py-1.5" />
                      {personColumns.map((col) => (
                        <td
                          key={`${person.id}-${group}-${col.id}`}
                          className={cn(PERSON_CHECKBOX_CELL_CLASS, 'border-border/40')}
                        />
                      ))}
                      {statusLabels.map((statusLabel) => {
                        const col = columnForStatus(groupCols, statusLabel);
                        if (!col) {
                          return (
                            <td
                              key={`${person.id}-${group}-${statusLabel}`}
                              className={cn(STATUS_CHECKBOX_CELL_CLASS, 'border-border/40')}
                            />
                          );
                        }
                        return (
                          <td
                            key={`${person.id}-${group}-${col.id}`}
                            className={cn(STATUS_CHECKBOX_CELL_CLASS, 'border-border/40')}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(checkboxValues[col.id])}
                              disabled
                              readOnly
                              aria-label={`${person.name} — ${translateCheckboxGroupLabel(t, group)} ${translateCheckboxColumnLabel(t, col)}`}
                              className={cn(CHECKBOX_SM_CLASS, 'cursor-default')}
                            />
                          </td>
                        );
                      })}
                      {showAudienceColumn ? (
                        <td className="border-l border-border/40 px-1 py-1.5 text-center text-xs">
                          {audience || '—'}
                        </td>
                      ) : null}
                      <td className="border-l border-border/40 px-1 py-1.5 text-center text-xs">
                        {size || '—'}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PublicEmptyPersons() {
  const { t } = useTranslation();
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{t('garments.noPersons')}</p>
  );
}
