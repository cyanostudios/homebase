import { Check, ChevronDown, ChevronRight, Edit, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItemCompact,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { nextListTableSort } from '@/core/list/listViewMode';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ListTableSortIcon } from '@/core/ui/ListTableSortIcon';
import { FORM_COMPACT_INPUT_CLASS, FORM_COMPACT_SELECT_CLASS } from '@/core/ui/formFieldStyles';
import { createSerialLatestQueue } from '@/core/utils/serialLatestQueue';
import type { SerialLatestSettle } from '@/core/utils/serialLatestQueue';
import { formatDate } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { Team } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type {
  FitSummaryProcurement,
  GarmentCheckboxColumn,
  GarmentList,
  GarmentPerson,
  InventoryItem,
} from '../types/garments';
import { ctFieldPatch, isCtSizeIncompatible } from '../utils/ctFieldPatch';
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
import { GARMENTS_SETTINGS_KEY } from '../utils/garmentColumnCount';
import {
  resolveVisiblePersonMatrixIdentityColumns,
  type PersonMatrixIdentityColumnId,
} from '../utils/personMatrixIdentityColumns';
import {
  buildGarmentListFitSummary,
  filterMatrixColumns,
  fitBreakdownKey,
  inventoryItemAudiences,
  inventoryItemIdFromGroupColumns,
  inventoryItemSizes,
  inventoryItemSizesForAudience,
  mergeFitSummaryProcurement,
  personHasFilledInventoryItem,
  resolveMatrixColumns,
  type GarmentFitSummaryEntry,
} from '../utils/inventoryListColumns';
import { MATRIX_TABLE_SCROLL_CLASS } from '../utils/variantListStyles';

function fitSummaryBreakdownLabel(
  t: (key: string) => string,
  row: { audience: string; size: string },
): { audience: string; size: string } {
  return {
    audience: row.audience || t('garments.fitSummaryAnyAudience'),
    size: row.size || t('garments.fitSummaryAnySize'),
  };
}

function GarmentListFitSummary({
  entries,
  editable = false,
  disabled = false,
  onPatch,
}: {
  entries: GarmentFitSummaryEntry[];
  editable?: boolean;
  disabled?: boolean;
  onPatch?: (partial: FitSummaryProcurement) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!entries.length) {
    return null;
  }

  const persist = async (partial: FitSummaryProcurement) => {
    if (!onPatch || disabled) {
      return;
    }
    setBusy(true);
    setSaveError(null);
    const ok = await onPatch(partial);
    if (!ok) {
      setSaveError(t('garments.fitSummarySaveFailed'));
    }
    setBusy(false);
  };

  const setRowOrdered = (
    entry: GarmentFitSummaryEntry,
    row: GarmentFitSummaryEntry['fitBreakdowns'][number],
    ordered: boolean,
  ) => {
    const key = fitBreakdownKey(row.audience, row.size);
    const patchRow: FitSummaryProcurement[string][string] = { ordered };
    if (ordered && (row.qtyOrdered == null || row.qtyOrdered === undefined)) {
      patchRow.qtyOrdered = row.count;
    }
    void persist({ [entry.itemId]: { [key]: patchRow } });
  };

  const setRowQty = (
    entry: GarmentFitSummaryEntry,
    row: GarmentFitSummaryEntry['fitBreakdowns'][number],
    raw: string,
  ) => {
    const key = fitBreakdownKey(row.audience, row.size);
    if (raw.trim() === '') {
      void persist({ [entry.itemId]: { [key]: { qtyOrdered: null } } });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return;
    }
    void persist({ [entry.itemId]: { [key]: { qtyOrdered: n } } });
  };

  const toggleArticleMaster = (entry: GarmentFitSummaryEntry) => {
    const keys = entry.fitBreakdowns.map((row) => fitBreakdownKey(row.audience, row.size));
    const values: Record<string, boolean> = {};
    for (const row of entry.fitBreakdowns) {
      values[fitBreakdownKey(row.audience, row.size)] = Boolean(row.ordered);
    }
    const state = getMasterCheckboxState(values, keys);
    const nextChecked = state.indeterminate || !state.checked;
    const itemPatch: FitSummaryProcurement[string] = {};
    for (const row of entry.fitBreakdowns) {
      const key = fitBreakdownKey(row.audience, row.size);
      const patchRow: FitSummaryProcurement[string][string] = { ordered: nextChecked };
      if (nextChecked && (row.qtyOrdered == null || row.qtyOrdered === undefined)) {
        patchRow.qtyOrdered = row.count;
      }
      itemPatch[key] = patchRow;
    }
    void persist({ [entry.itemId]: itemPatch });
  };

  return (
    <section
      className="mt-4 space-y-3 border-t border-border/50 pt-4"
      data-testid="garment-fit-summary"
      aria-labelledby="fit-summary-heading"
    >
      <div>
        <h3 id="fit-summary-heading" className="text-sm font-semibold text-foreground">
          {t('garments.fitSummaryTitle')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {editable ? t('garments.fitSummaryHint') : t('garments.fitSummaryPublicHint')}
        </p>
        {saveError ? (
          <p
            role="status"
            className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {saveError}
          </p>
        ) : null}
      </div>

      <div className={MATRIX_TABLE_SCROLL_CLASS}>
        <table className="w-max min-w-full border-collapse text-sm">
          {entries.map((entry) => {
            const masterKeys = entry.fitBreakdowns.map((row) =>
              fitBreakdownKey(row.audience, row.size),
            );
            const masterValues: Record<string, boolean> = {};
            for (const row of entry.fitBreakdowns) {
              masterValues[fitBreakdownKey(row.audience, row.size)] = Boolean(row.ordered);
            }
            const master = getMasterCheckboxState(masterValues, masterKeys);
            const articleHeadingId = `fit-summary-article-${entry.itemId}`;

            return (
              <tbody key={entry.itemId} role="group" aria-labelledby={articleHeadingId}>
                <tr className="border-b border-border bg-primary/5">
                  <th
                    scope="col"
                    id={articleHeadingId}
                    title={t('garments.fitSummaryColumnAudience')}
                    className={cn(
                      'border-r border-border px-3 py-1.5 text-left',
                      MATRIX_HEADER_BASE,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="min-w-0 truncate text-sm font-semibold normal-case tracking-normal text-foreground"
                        title={entry.articleName}
                      >
                        {entry.articleName}
                      </span>
                      {editable ? (
                        <MasterStatusCheckbox
                          checked={master.checked}
                          indeterminate={master.indeterminate}
                          disabled={disabled || busy}
                          ariaLabel={t('garments.fitSummaryArticleOrderedAria', {
                            articleName: entry.articleName,
                          })}
                          onToggle={() => toggleArticleMaster(entry)}
                        />
                      ) : null}
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        {t('garments.fitSummaryFilled', {
                          filled: entry.filledCount,
                          total: entry.personCount,
                        })}
                      </span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    className={cn(
                      'border-r border-border px-1.5 py-1.5 text-left',
                      MATRIX_HEADER_BASE,
                    )}
                  >
                    {t('garments.fitSummaryColumnSize')}
                  </th>
                  <th
                    scope="col"
                    className={cn(
                      'border-r border-border px-1.5 py-1.5 text-center',
                      MATRIX_HEADER_BASE,
                      !editable && 'border-r-0',
                    )}
                  >
                    {t('garments.fitSummaryColumnNeeded')}
                  </th>
                  {editable ? (
                    <>
                      <th
                        scope="col"
                        className={cn(STATUS_CHECKBOX_COL_CLASS, 'py-1.5 last:border-r-0')}
                        title={t('garments.fitSummaryColumnOrderedTitle')}
                      >
                        {t('garments.fitSummaryColumnOrdered')}
                      </th>
                      <th
                        scope="col"
                        className={cn(
                          'w-14 border-r border-border px-1 py-1.5 text-center last:border-r-0',
                          MATRIX_HEADER_BASE,
                        )}
                      >
                        {t('garments.fitSummaryColumnQtyOrdered')}
                      </th>
                    </>
                  ) : null}
                </tr>
                {entry.fitBreakdowns.map((row) => {
                  const labels = fitSummaryBreakdownLabel(t, row);
                  const rowKey = `${entry.itemId}\u001f${row.audience}\u001f${row.size}`;
                  return (
                    <tr key={rowKey} className="border-b border-border/60">
                      <td className="border-r border-border/50 px-3 py-1.5 text-muted-foreground">
                        {labels.audience}
                      </td>
                      <td className="border-r border-border/50 px-1.5 py-1.5 font-medium tabular-nums text-foreground">
                        {labels.size}
                      </td>
                      <td
                        className={cn(
                          'border-r border-border/50 px-1.5 py-1.5 text-center tabular-nums text-foreground',
                          !editable && 'border-r-0',
                        )}
                      >
                        {row.count}
                      </td>
                      {editable ? (
                        <>
                          <td className="flex items-center justify-center border-r border-border/50 px-2.5 py-1.5 align-middle">
                            <input
                              type="checkbox"
                              checked={Boolean(row.ordered)}
                              disabled={disabled || busy}
                              onChange={() => setRowOrdered(entry, row, !row.ordered)}
                              aria-label={t('garments.fitSummaryRowOrderedAria', {
                                articleName: entry.articleName,
                                audience: labels.audience,
                                size: labels.size,
                              })}
                              className={cn(
                                CHECKBOX_SM_CLASS,
                                'mx-auto block cursor-pointer disabled:cursor-default',
                              )}
                            />
                          </td>
                          <td className="border-r border-border/50 px-1 py-1.5 text-center last:border-r-0">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              disabled={disabled || busy}
                              defaultValue={row.qtyOrdered != null ? String(row.qtyOrdered) : ''}
                              key={`${rowKey}:${row.qtyOrdered ?? 'empty'}`}
                              placeholder={String(row.count)}
                              aria-label={t('garments.fitSummaryQtyOrderedAria', {
                                articleName: entry.articleName,
                                audience: labels.audience,
                                size: labels.size,
                              })}
                              className={cn(
                                MATRIX_INPUT_CENTER_CLASS,
                                'mx-auto w-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                              )}
                              onBlur={(e) => setRowQty(entry, row, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

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

/** Compact matrix selects — filled chrome, primary text when a value is chosen. */
const MATRIX_SELECT_TRIGGER_CLASS = cn(
  FORM_COMPACT_SELECT_CLASS,
  'min-w-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40',
);
const MATRIX_SELECT_CONTENT_CLASS = 'min-w-[var(--radix-select-trigger-width)] p-0.5';
const MATRIX_INPUT_CLASS = FORM_COMPACT_INPUT_CLASS;
const MATRIX_INPUT_CENTER_CLASS = cn(FORM_COMPACT_INPUT_CLASS, 'px-1 text-center');
const MATRIX_AMBER_RING_CLASS =
  'ring-1 ring-amber-400 focus:ring-amber-400 focus-visible:ring-amber-400';

function matrixSelectTriggerClass(hasValue: boolean): string {
  return cn(MATRIX_SELECT_TRIGGER_CLASS, hasValue && '[&>span]:font-medium [&>span]:text-primary');
}

type PersonMatrixSortField = 'name' | 'team' | 'jerseyNumber' | 'createdAt';

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
  if (field === 'createdAt') {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return order === 'asc' ? aTime - bTime : bTime - aTime;
  }

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
}) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const {
    updatePerson,
    patchPersonLocal,
    deletePerson,
    inventoryItems,
    updatePersonCtSizes,
    openGarmentsInventory,
    patchFitSummaryProcurement,
  } = useGarments();
  const persons = list.persons ?? [];
  const listRef = useRef(list);
  listRef.current = list;
  const checkboxQueueRef = useRef(createSerialLatestQueue());
  const checkboxRollbackRef = useRef<Map<string, Record<string, boolean>>>(new Map());
  const latestCheckboxRef = useRef<Map<string, Record<string, boolean>>>(new Map());
  const [checkboxSaveError, setCheckboxSaveError] = useState<string | null>(null);
  const [visibleIdentityIds, setVisibleIdentityIds] = useState<PersonMatrixIdentityColumnId[]>(() =>
    resolveVisiblePersonMatrixIdentityColumns(null, list.id),
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleIdentityIds(resolveVisiblePersonMatrixIdentityColumns(settings, list.id));
      })
      .catch(() => {
        if (!cancelled) {
          setVisibleIdentityIds(resolveVisiblePersonMatrixIdentityColumns(null, list.id));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, list.id, settingsVersion]);

  const matrixIdentityColumnIds = useMemo(
    () => visibleIdentityIds.filter((id) => id !== 'team' || hasTeams),
    [visibleIdentityIds, hasTeams],
  );

  useEffect(() => {
    const queue = checkboxQueueRef.current;
    return () => {
      queue.clear();
    };
  }, []);
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

  const fitSummary = useMemo(
    () =>
      mergeFitSummaryProcurement(
        buildGarmentListFitSummary(persons, garmentGroups, inventoryItems),
        list.fitSummaryProcurement,
      ),
    [persons, garmentGroups, inventoryItems, list.fitSummaryProcurement],
  );

  const handleFitSummaryPatch = useCallback(
    (partial: FitSummaryProcurement) => patchFitSummaryProcurement(list.id, partial),
    [list.id, patchFitSummaryProcurement],
  );

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
    const current =
      person.teamId != null && String(person.teamId).trim() !== '' ? String(person.teamId) : null;
    const next = nextTeamId != null && String(nextTeamId).trim() !== '' ? String(nextTeamId) : null;
    if (next === current) {
      return;
    }
    // Optimistic so soft-preview Select does not snap back while the PUT is in flight.
    patchPersonLocal(list.id, person.id, { teamId: next });
    const saved = await updatePerson(
      list.id,
      person.id,
      personFieldPayload(person, { teamId: next }),
    );
    if (!saved) {
      patchPersonLocal(list.id, person.id, { teamId: current });
    }
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
    // Empty string must be sent so the server clears the key (partial merge).
    const ctSizes = ctFieldPatch(itemId, next);
    patchPersonLocal(list.id, person.id, {
      ctSizes: { ...(person.ctSizes ?? {}), ...ctSizes },
    });
    const saved = await updatePersonCtSizes(list.id, person.id, { ctSizes });
    if (!saved) {
      patchPersonLocal(list.id, person.id, { ctSizes: person.ctSizes ?? {} });
    }
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
    const ctAudiences = ctFieldPatch(itemId, next);
    const currentSize = person.ctSizes?.[itemId] ?? '';
    const allowed = inventoryItemSizesForAudience(inventoryItem, next);
    const clearSize = isCtSizeIncompatible(currentSize, allowed);
    const ctSizes = clearSize ? ctFieldPatch(itemId, '') : undefined;
    const prevSizes = person.ctSizes ?? {};
    const prevAudiences = person.ctAudiences ?? {};
    patchPersonLocal(list.id, person.id, {
      ctAudiences: { ...prevAudiences, ...ctAudiences },
      ...(ctSizes ? { ctSizes: { ...prevSizes, ...ctSizes } } : {}),
    });
    const saved = await updatePersonCtSizes(list.id, person.id, {
      ctAudiences,
      ...(ctSizes ? { ctSizes } : {}),
    });
    if (!saved) {
      patchPersonLocal(list.id, person.id, {
        ctAudiences: prevAudiences,
        ctSizes: prevSizes,
      });
    }
  };

  const enqueueOptimisticCheckboxSave = (
    person: GarmentPerson,
    nextValues: Record<string, boolean>,
  ) => {
    const key = String(person.id);
    const queue = checkboxQueueRef.current;
    if (!queue.isBusy(key) && !checkboxRollbackRef.current.has(key)) {
      checkboxRollbackRef.current.set(key, { ...(person.checkboxValues ?? {}) });
    }
    latestCheckboxRef.current.set(key, nextValues);
    patchPersonLocal(list.id, person.id, { checkboxValues: nextValues });

    queue.enqueue({
      key,
      payload: nextValues,
      save: async () => {
        const latestList = listRef.current;
        const latestPerson = latestList.persons?.find((p) => String(p.id) === key);
        if (!latestPerson) {
          throw new Error('Person not found');
        }
        const checkboxValues =
          latestCheckboxRef.current.get(key) ?? latestPerson.checkboxValues ?? {};
        const saved = await updatePerson(
          latestList.id,
          latestPerson.id,
          personFieldPayload(latestPerson, { checkboxValues }),
          { updateLocalState: false },
        );
        if (!saved) {
          throw new Error('updatePerson failed');
        }
        return saved;
      },
      onSettle: (event: SerialLatestSettle<GarmentPerson>) => {
        if (event.kind === 'committed') {
          checkboxRollbackRef.current.delete(key);
          if (event.result) {
            latestCheckboxRef.current.set(key, event.result.checkboxValues ?? {});
            patchPersonLocal(list.id, key, event.result);
          }
          setCheckboxSaveError(null);
          return;
        }
        if (event.kind === 'failed' && event.shouldRollback) {
          const snap = checkboxRollbackRef.current.get(key);
          checkboxRollbackRef.current.delete(key);
          if (snap) {
            latestCheckboxRef.current.set(key, snap);
            patchPersonLocal(list.id, key, { checkboxValues: snap });
          }
          setCheckboxSaveError(t('garments.saveFailed'));
        }
      },
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
      await updatePerson(
        list.id,
        person.id,
        personFieldPayload(person, {
          checkboxValues: next,
          jerseyName: editDraft.jerseyName ?? person.jerseyName,
          initials: editDraft.initials ?? person.initials,
          name: editDraft.name ?? person.name,
        }),
      );
      return;
    }
    enqueueOptimisticCheckboxSave(person, next);
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
      await updatePerson(
        list.id,
        person.id,
        personFieldPayload(person, {
          checkboxValues: next,
          jerseyName: editDraft.jerseyName ?? person.jerseyName,
          initials: editDraft.initials ?? person.initials,
          name: editDraft.name ?? person.name,
        }),
      );
      return;
    }
    enqueueOptimisticCheckboxSave(person, next);
  };

  return (
    <div className="min-w-0 space-y-3">
      {checkboxSaveError ? (
        <div
          role="status"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {checkboxSaveError}
        </div>
      ) : null}

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
                {matrixIdentityColumnIds.map((columnId) => {
                  if (columnId === 'name') {
                    return (
                      <th
                        key={columnId}
                        className={cn(
                          'border-r border-border bg-primary/5 px-3 py-2 text-left',
                          MATRIX_HEADER_BASE,
                        )}
                        aria-sort={
                          primarySort === 'name' || primarySort === 'createdAt'
                            ? sortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="flex cursor-pointer items-center gap-2 leading-4 select-none hover:text-foreground"
                            onClick={() => handleHeaderSort('name')}
                          >
                            <span>{t('garments.personName')}</span>
                            <ListTableSortIcon active={primarySort === 'name'} order={sortOrder} />
                          </button>
                          <button
                            type="button"
                            className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold leading-tight text-slate-400 select-none hover:text-foreground dark:text-slate-500"
                            onClick={() => handleHeaderSort('createdAt')}
                          >
                            <span>{t('common.created')}</span>
                            <ListTableSortIcon
                              active={primarySort === 'createdAt'}
                              order={sortOrder}
                            />
                          </button>
                        </div>
                      </th>
                    );
                  }
                  if (columnId === 'team') {
                    return (
                      <th
                        key={columnId}
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
                    );
                  }
                  if (columnId === 'jerseyName') {
                    return (
                      <th
                        key={columnId}
                        className={cn(
                          'border-r border-border px-1.5 py-2 text-center',
                          MATRIX_HEADER_BASE,
                        )}
                      >
                        {t('garments.jerseyName')}
                      </th>
                    );
                  }
                  if (columnId === 'initials') {
                    return (
                      <th
                        key={columnId}
                        className={cn(
                          'w-11 border-r border-border px-0.5 py-2 text-center',
                          MATRIX_HEADER_BASE,
                        )}
                      >
                        {t('garments.initials')}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={columnId}
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
                        <ListTableSortIcon
                          active={primarySort === 'jerseyNumber'}
                          order={sortOrder}
                        />
                      </div>
                    </th>
                  );
                })}
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
                      {matrixIdentityColumnIds.map((columnId) => {
                        if (columnId === 'name') {
                          const createdLabel = formatDate(person.createdAt);
                          return (
                            <td
                              key={columnId}
                              className="border-r border-border bg-background px-1 py-1.5"
                            >
                              <div className="flex min-w-0 items-start gap-0.5">
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
                                    'mt-2.5 h-2 w-2 shrink-0 rounded-full',
                                    personCompletionDotClass(completionStatus),
                                  )}
                                  title={completionLabel}
                                  aria-label={completionLabel}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  {isEditing ? (
                                    <Input
                                      value={editDraft.name ?? ''}
                                      onChange={(e) =>
                                        setEditDraft((prev) => ({ ...prev, name: e.target.value }))
                                      }
                                      aria-label={t('garments.personName')}
                                      className={cn(
                                        MATRIX_INPUT_CLASS,
                                        'min-w-0 flex-1',
                                        jerseyDup && MATRIX_AMBER_RING_CLASS,
                                      )}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className="min-w-0 truncate px-1 text-left text-sm font-medium hover:underline"
                                      onClick={() => {
                                        if (showGarmentColumns) {
                                          toggleExpanded(person.id);
                                        }
                                      }}
                                    >
                                      {person.name || '—'}
                                    </button>
                                  )}
                                  {createdLabel ? (
                                    <span className="min-w-0 truncate px-1 text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                                      {createdLabel}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (columnId === 'team') {
                          return (
                            <td
                              key={columnId}
                              className="min-w-[8rem] border-r border-border/50 px-1 py-1.5"
                            >
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
                                    className={MATRIX_SELECT_TRIGGER_CLASS}
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
                                  value={
                                    person.teamId != null && String(person.teamId).trim() !== ''
                                      ? String(person.teamId)
                                      : '__none__'
                                  }
                                  onValueChange={(value) =>
                                    void saveTeamField(person, value === '__none__' ? null : value)
                                  }
                                >
                                  <SelectTrigger
                                    aria-label={`${person.name} — ${t('garments.team')}`}
                                    className={MATRIX_SELECT_TRIGGER_CLASS}
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
                          );
                        }
                        if (columnId === 'jerseyName') {
                          return (
                            <td key={columnId} className="border-r border-border/50 px-1 py-1.5">
                              {readOnly ? (
                                <span className="block truncate px-1 text-xs">
                                  {person.jerseyName?.trim() || '—'}
                                </span>
                              ) : isEditing ? (
                                <Input
                                  value={editDraft.jerseyName ?? ''}
                                  onChange={(e) =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      jerseyName: e.target.value,
                                    }))
                                  }
                                  aria-label={t('garments.jerseyName')}
                                  className={MATRIX_INPUT_CLASS}
                                />
                              ) : (
                                <Input
                                  defaultValue={person.jerseyName ?? ''}
                                  key={`${person.id}-jerseyName-${person.jerseyName ?? ''}`}
                                  onBlur={(e) =>
                                    void saveTextField(person, 'jerseyName', e.target.value)
                                  }
                                  aria-label={t('garments.jerseyName')}
                                  className={MATRIX_INPUT_CLASS}
                                />
                              )}
                            </td>
                          );
                        }
                        if (columnId === 'initials') {
                          return (
                            <td
                              key={columnId}
                              className="w-11 border-r border-border/50 px-0.5 py-1.5"
                            >
                              {readOnly ? (
                                <span className="block truncate px-0.5 text-center text-xs">
                                  {person.initials?.trim() || '—'}
                                </span>
                              ) : isEditing ? (
                                <Input
                                  value={editDraft.initials ?? ''}
                                  onChange={(e) =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      initials: e.target.value,
                                    }))
                                  }
                                  aria-label={t('garments.initials')}
                                  className={MATRIX_INPUT_CENTER_CLASS}
                                />
                              ) : (
                                <Input
                                  defaultValue={person.initials ?? ''}
                                  key={`${person.id}-initials-${person.initials ?? ''}`}
                                  onBlur={(e) =>
                                    void saveTextField(person, 'initials', e.target.value)
                                  }
                                  aria-label={t('garments.initials')}
                                  className={MATRIX_INPUT_CENTER_CLASS}
                                />
                              )}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={columnId}
                            className="w-12 border-r border-border/50 px-0.5 py-1.5"
                          >
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
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    jerseyNumber: e.target.value,
                                  }))
                                }
                                aria-label={t('garments.jerseyNumber')}
                                className={cn(
                                  MATRIX_INPUT_CENTER_CLASS,
                                  jerseyDup && MATRIX_AMBER_RING_CLASS,
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
                                  MATRIX_INPUT_CENTER_CLASS,
                                  jerseyDup && MATRIX_AMBER_RING_CLASS,
                                )}
                              />
                            )}
                          </td>
                        );
                      })}
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
                              {matrixIdentityColumnIds.map((columnId) =>
                                columnId === 'name' ? (
                                  <td
                                    key={columnId}
                                    className="border-r border-border bg-muted/10 py-1.5 pl-9 pr-2 text-xs text-muted-foreground"
                                  >
                                    {translateCheckboxGroupLabel(t, group)}
                                  </td>
                                ) : (
                                  <td
                                    key={columnId}
                                    className={cn(
                                      'border-r border-border/40 py-1.5',
                                      columnId === 'team' || columnId === 'jerseyName'
                                        ? 'px-1'
                                        : 'px-0.5',
                                    )}
                                  />
                                ),
                              )}
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
                                          className={cn(MATRIX_INPUT_CLASS, 'min-w-[3.5rem]')}
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

      <GarmentListFitSummary
        entries={fitSummary}
        editable={!readOnly}
        disabled={readOnly}
        onPatch={handleFitSummaryPatch}
      />

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

  const fitSummary = useMemo(
    () => mergeFitSummaryProcurement(buildGarmentListFitSummary(persons, garmentGroups, []), {}),
    [persons, garmentGroups],
  );

  if (persons.length === 0) {
    return <PublicEmptyPersons />;
  }

  return (
    <div>
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
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate">{person.name || '—'}</span>
                        {formatDate(person.createdAt) ? (
                          <span className="truncate text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                            {formatDate(person.createdAt)}
                          </span>
                        ) : null}
                      </div>
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
                      inventoryItemId != null
                        ? (person.ctSizes?.[inventoryItemId] ?? '').trim()
                        : '';
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
      <GarmentListFitSummary entries={fitSummary} editable={false} />
    </div>
  );
}

function PublicEmptyPersons() {
  const { t } = useTranslation();
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{t('garments.noPersons')}</p>
  );
}
