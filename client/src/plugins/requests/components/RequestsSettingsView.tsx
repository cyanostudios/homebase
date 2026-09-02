import { Check, ChevronDown, Grip, Link2, Plus, Settings2, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import { garmentsApi } from '@/plugins/garments/api/garmentsApi';
import type { GarmentList } from '@/plugins/garments/types/garments';

import { useRequests } from '../hooks/useRequests';
import { BUILTIN_REQUEST_TYPE_KEYS, getTypeLabel } from '../types/requests';
import {
  DEFAULT_GARMENTS_INTAKE_SCHEMA,
  groupGarmentListsForSelect,
  intakeFieldLabelKey,
  type RequestTypeConfig,
} from '../utils/requestTypeConfig';
import {
  REQUESTS_SETTINGS_KEY,
  isRequestTableColumnId,
  normalizeRequestTableColumns,
  reorderRequestTableColumns,
  requestTableColumnsEqual,
  setRequestTableColumnHidden,
  type RequestTableColumnId,
  type RequestTableColumnsPref,
} from '../utils/requestTableColumns';

const COLUMN_LABEL_KEYS: Record<RequestTableColumnId, string> = {
  title: 'requests.form.title',
  status: 'requests.form.status',
  priority: 'requests.form.priority',
  type: 'requests.form.requestType',
  responseDueAt: 'requests.responseDue.label',
  source: 'requests.view.source',
  created_at: 'common.created',
  updated_at: 'common.updated',
};

export type RequestsSettingsCategory = 'types' | 'columns';

interface RequestsSettingsViewProps {
  selectedCategory?: RequestsSettingsCategory;
  onSelectedCategoryChange?: (category: RequestsSettingsCategory) => void;
  onClose?: () => void;
}

export function RequestsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: RequestsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { requestTypes, saveRequestTypes } = useRequests();
  const enabledPlugins = useEnabledPlugins();
  const garmentsEnabled = enabledPlugins.has('garments');

  const [internalCategory, setInternalCategory] = useState<RequestsSettingsCategory>('types');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tableColumns, setTableColumns] = useState<RequestTableColumnsPref>(() =>
    normalizeRequestTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<RequestTableColumnsPref>(() =>
    normalizeRequestTableColumns(null),
  );
  const [isColumnsLoading, setIsColumnsLoading] = useState(true);
  const [isColumnsSaving, setIsColumnsSaving] = useState(false);

  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [confirmUnlinkKey, setConfirmUnlinkKey] = useState<string | null>(null);
  const [expandedLinkKey, setExpandedLinkKey] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const [garmentLists, setGarmentLists] = useState<GarmentList[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!garmentsEnabled) {
      setGarmentLists([]);
      setListsLoaded(true);
      return;
    }
    let cancelled = false;
    setListsLoaded(false);
    garmentsApi
      .getLists()
      .then((lists) => {
        if (!cancelled) {
          setGarmentLists(lists);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGarmentLists([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [garmentsEnabled]);

  useEffect(() => {
    let cancelled = false;
    getSettings(REQUESTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeRequestTableColumns(settings?.tableColumns);
        setTableColumns(loaded);
        setInitialTableColumns(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsColumnsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'types',
        label: t('requests.settingsCategories.types'),
        description: t('requests.settingsCategories.typesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.categories,
      },
      {
        id: 'columns',
        label: t('requests.settingsCategories.columns'),
        description: t('requests.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
    ],
    [t],
  );

  const columnsDirty =
    activeCategory === 'columns' && !requestTableColumnsEqual(tableColumns, initialTableColumns);

  const handleSaveColumns = useCallback(async () => {
    setIsColumnsSaving(true);
    try {
      const next = normalizeRequestTableColumns(tableColumns);
      await updateSettings(REQUESTS_SETTINGS_KEY, { tableColumns: next });
      setTableColumns(next);
      setInitialTableColumns(next);
    } catch (error) {
      console.error('Failed to save requests table columns:', error);
    } finally {
      setIsColumnsSaving(false);
    }
  }, [tableColumns, updateSettings]);

  const listById = useMemo(() => {
    const map = new Map<string, GarmentList>();
    for (const list of garmentLists) {
      map.set(String(list.id), list);
    }
    return map;
  }, [garmentLists]);

  const groupedLists = useMemo(() => groupGarmentListsForSelect(garmentLists), [garmentLists]);

  const persistTypes = useCallback(
    async (next: RequestTypeConfig[]) => {
      setIsSaving(true);
      setRowError(null);
      try {
        await saveRequestTypes(next);
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('requests.settings.saveError');
        setRowError(message);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [saveRequestTypes, t],
  );

  const handleAdd = useCallback(async () => {
    const label = newTypeLabel.trim();
    if (!label) {
      return;
    }
    if (requestTypes.some((type) => type.key === label)) {
      return;
    }
    try {
      await persistTypes([...requestTypes, { key: label }]);
      setNewTypeLabel('');
      inputRef.current?.focus();
    } catch {
      /* rowError set */
    }
  }, [newTypeLabel, requestTypes, persistTypes]);

  const handleRemove = useCallback(
    async (typeKey: string) => {
      try {
        await persistTypes(requestTypes.filter((type) => type.key !== typeKey));
        setConfirmDeleteKey(null);
        if (expandedLinkKey === typeKey) {
          setExpandedLinkKey(null);
        }
      } catch {
        /* rowError set */
      }
    },
    [requestTypes, persistTypes, expandedLinkKey],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleAdd();
    }
  };

  const reorderTypes = useCallback(
    async (sourceType: string, targetType: string) => {
      if (sourceType === targetType) {
        return;
      }
      const fromIndex = requestTypes.findIndex((type) => type.key === sourceType);
      const toIndex = requestTypes.findIndex((type) => type.key === targetType);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return;
      }

      const next = [...requestTypes];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      try {
        await persistTypes(next);
      } catch {
        /* rowError set */
      }
    },
    [requestTypes, persistTypes],
  );

  const updateTypeConfig = useCallback(
    async (typeKey: string, patch: Partial<RequestTypeConfig>) => {
      const next = requestTypes.map((type) =>
        type.key === typeKey ? { ...type, ...patch } : type,
      );
      await persistTypes(next);
    },
    [requestTypes, persistTypes],
  );

  const linkToGarments = useCallback(
    async (typeKey: string) => {
      const existing = requestTypes.find((type) => type.key === typeKey);
      const alreadyLinked = existing?.plugin === 'garments';
      try {
        await updateTypeConfig(typeKey, {
          plugin: 'garments',
          targetListId: alreadyLinked ? (existing?.targetListId ?? null) : null,
          intakeSchema: alreadyLinked
            ? (existing?.intakeSchema ?? DEFAULT_GARMENTS_INTAKE_SCHEMA)
            : DEFAULT_GARMENTS_INTAKE_SCHEMA,
        });
      } catch {
        /* rowError set */
      }
    },
    [requestTypes, updateTypeConfig],
  );

  const unlinkPlugin = useCallback(
    async (typeKey: string) => {
      try {
        await updateTypeConfig(typeKey, {
          plugin: null,
          targetListId: null,
          intakeSchema: null,
        });
        setConfirmUnlinkKey(null);
      } catch {
        /* rowError set */
      }
    },
    [updateTypeConfig],
  );

  const setTargetList = useCallback(
    async (typeKey: string, targetListId: string) => {
      try {
        await updateTypeConfig(typeKey, {
          plugin: 'garments',
          targetListId: targetListId || null,
          intakeSchema:
            requestTypes.find((type) => type.key === typeKey)?.intakeSchema ??
            DEFAULT_GARMENTS_INTAKE_SCHEMA,
        });
      } catch {
        /* rowError set */
      }
    },
    [requestTypes, updateTypeConfig],
  );

  const handleDragStart = (e: React.DragEvent, typeKey: string) => {
    setDraggingType(typeKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', typeKey);
  };

  const handleDragOver = (e: React.DragEvent, typeKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingType && draggingType !== typeKey) {
      setDragOverType(typeKey);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('text/plain') || draggingType;
    if (sourceType) {
      await reorderTypes(sourceType, targetType);
    }
    setDraggingType(null);
    setDragOverType(null);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
    setDragOverType(null);
  };

  const renderListOptions = (type: RequestTypeConfig) => {
    const selectedId = type.targetListId ? String(type.targetListId) : '';
    const orphaned = Boolean(selectedId && listsLoaded && !listById.has(selectedId));
    const empty = listsLoaded && garmentLists.length === 0;

    return (
      <div className="space-y-1.5">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor={`target-list-${type.key}`}
        >
          {t('requests.settings.targetList')}
        </label>
        <select
          id={`target-list-${type.key}`}
          value={orphaned ? '__missing__' : selectedId}
          disabled={isSaving || empty}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '__missing__') {
              return;
            }
            void setTargetList(type.key, value);
          }}
          className="h-8 w-full max-w-sm rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">{t('requests.settings.targetListPlaceholder')}</option>
          {orphaned ? (
            <option value="__missing__">{t('requests.settings.targetListMissing')}</option>
          ) : null}
          {groupedLists.matching.length > 0 ? (
            <optgroup label={t('requests.settings.teamLists')}>
              {groupedLists.matching.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {groupedLists.other.length > 0 ? (
            <optgroup label={t('requests.settings.otherLists')}>
              {groupedLists.other.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        {empty ? (
          <p className="text-xs text-muted-foreground">{t('requests.settings.targetListEmpty')}</p>
        ) : null}
        {orphaned ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('requests.settings.targetListMissingHint')}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <PluginSettingsPageShell
      title={t('requests.settings.title')}
      subtitle={t('requests.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as RequestsSettingsCategory)}
      onClose={onClose}
      onSave={columnsDirty ? () => void handleSaveColumns() : undefined}
      isSaving={isColumnsSaving}
      saveAction={
        columnsDirty ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSaveColumns()}
            isSaving={isColumnsSaving}
            label={t('common.save')}
            savingLabel={t('common.saving')}
          />
        ) : null
      }
    >
      {activeCategory === 'columns' &&
        (isColumnsLoading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <TableColumnsSettingsSection
            title={t('requests.settingsCategories.columns')}
            hint={t('requests.settingsCategories.columnsHint')}
            pref={tableColumns}
            requiredColumnId="title"
            labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
            isColumnId={isRequestTableColumnId}
            reorder={reorderRequestTableColumns}
            setHidden={setRequestTableColumnHidden}
            onChange={setTableColumns}
          />
        ))}

      {activeCategory === 'types' && (
        <DetailSection
          title={t('requests.settings.typesSection')}
          icon={Settings2}
          iconPlugin="requests"
          className="pt-0"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('requests.settings.typesHint')}</p>

            {rowError ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              >
                {rowError}
              </div>
            ) : null}

            <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
              {requestTypes.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  {t('requests.settings.noTypes')}
                </li>
              )}
              {requestTypes.map((type) => {
                const isBuiltin = BUILTIN_REQUEST_TYPE_KEYS.includes(type.key);
                const label = getTypeLabel(type.key, t);
                const isConfirming = confirmDeleteKey === type.key;
                const isExpanded = expandedLinkKey === type.key;
                const isLinked = type.plugin === 'garments';
                const isUnlinkConfirming = confirmUnlinkKey === type.key;
                const intakeFields = type.intakeSchema ?? DEFAULT_GARMENTS_INTAKE_SCHEMA;

                return (
                  <li
                    key={type.key}
                    draggable={!isSaving}
                    onDragStart={(e) => handleDragStart(e, type.key)}
                    onDragOver={(e) => handleDragOver(e, type.key)}
                    onDrop={(e) => void handleDrop(e, type.key)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={() => {
                      if (dragOverType === type.key) {
                        setDragOverType(null);
                      }
                    }}
                    className={cn(
                      'px-4 py-2.5 transition-colors',
                      draggingType === type.key && 'opacity-50',
                      dragOverType === type.key && 'bg-muted/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Grip
                          className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                          aria-hidden
                        />
                        <span className="text-sm font-medium">{label}</span>
                        {isBuiltin && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">
                            {t('requests.settings.builtIn')}
                          </span>
                        )}
                        {garmentsEnabled && isLinked ? (
                          <span className="sr-only">{t('requests.settings.linkedToGarments')}</span>
                        ) : null}
                        {garmentsEnabled && isLinked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Link2 className="h-3 w-3" aria-hidden />
                            {t('requests.settings.linkGarments')}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        {garmentsEnabled ? (
                          <RoundIconLabelButton
                            type="button"
                            icon={ChevronDown}
                            label={t('requests.settings.linkSection')}
                            variant="secondary"
                            size="xs"
                            alwaysExpanded
                            className={cn(isExpanded && 'bg-primary/20')}
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedLinkKey((prev) => (prev === type.key ? null : type.key))
                            }
                          />
                        ) : null}

                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <span className="mr-1 text-xs text-muted-foreground">
                              {t('requests.settings.confirmRemove')}
                            </span>
                            <RoundIconLabelButton
                              type="button"
                              icon={Check}
                              label={t('common.yes')}
                              variant="danger"
                              size="xs"
                              alwaysExpanded
                              disabled={isSaving}
                              onClick={() => void handleRemove(type.key)}
                            />
                            <RoundIconLabelButton
                              type="button"
                              icon={X}
                              label={t('common.cancel')}
                              variant="secondary"
                              size="xs"
                              alwaysExpanded
                              onClick={() => setConfirmDeleteKey(null)}
                            />
                          </div>
                        ) : (
                          <RoundIconLabelButton
                            type="button"
                            icon={Trash2}
                            label={t('common.remove')}
                            variant="dangerSoft"
                            size="xs"
                            expandOnHover={false}
                            onClick={() => setConfirmDeleteKey(type.key)}
                          />
                        )}
                      </div>
                    </div>

                    {garmentsEnabled && isExpanded ? (
                      <div className="mt-3 space-y-3 border-t border-border/40 pt-3 pl-6">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('requests.settings.destination')}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="radio"
                                name={`plugin-${type.key}`}
                                checked={!isLinked}
                                disabled={isSaving}
                                onChange={() => {
                                  if (isLinked && type.targetListId) {
                                    setConfirmUnlinkKey(type.key);
                                    return;
                                  }
                                  void unlinkPlugin(type.key);
                                }}
                              />
                              {t('requests.settings.linkNone')}
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="radio"
                                name={`plugin-${type.key}`}
                                checked={isLinked}
                                disabled={isSaving}
                                onChange={() => void linkToGarments(type.key)}
                              />
                              {t('requests.settings.linkGarments')}
                            </label>
                          </div>
                        </div>

                        {isUnlinkConfirming ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            <span>{t('requests.settings.unlinkConfirm')}</span>
                            <RoundIconLabelButton
                              type="button"
                              icon={Check}
                              label={t('common.yes')}
                              variant="secondary"
                              size="xs"
                              alwaysExpanded
                              disabled={isSaving}
                              onClick={() => void unlinkPlugin(type.key)}
                            />
                            <RoundIconLabelButton
                              type="button"
                              icon={X}
                              label={t('common.cancel')}
                              variant="secondary"
                              size="xs"
                              alwaysExpanded
                              onClick={() => setConfirmUnlinkKey(null)}
                            />
                          </div>
                        ) : null}

                        {isLinked ? (
                          <>
                            {renderListOptions(type)}
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                {t('requests.settings.intakeFieldsHint')}
                              </p>
                              <p className="text-xs text-foreground">
                                {intakeFields
                                  .map((field) => {
                                    const fieldLabel = t(intakeFieldLabelKey(field.key));
                                    return field.required ? `${fieldLabel}*` : fieldLabel;
                                  })
                                  .join(' · ')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('requests.settings.linkHint')}
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2 pt-1">
              <Input
                ref={inputRef}
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('requests.settings.addTypePlaceholder')}
                className="h-8 max-w-xs text-xs"
              />
              <RoundIconLabelButton
                type="button"
                icon={Plus}
                label={t('requests.settings.addType')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                disabled={!newTypeLabel.trim() || isSaving}
                onClick={() => void handleAdd()}
              />
            </div>
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
