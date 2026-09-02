import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { useGarments } from '../hooks/useGarments';
import type { GarmentCheckboxColumn } from '../types/garments';
import {
  applyPersonCheckboxColumnDraft,
  listEditablePersonCheckboxColumns,
  personCheckboxColumnsEqual,
} from '../utils/customCheckboxColumns';
import { createDefaultCheckboxColumns } from '../utils/defaultCheckboxTemplate';
import { GARMENTS_SETTINGS_KEY } from '../utils/garmentColumnCount';
import {
  getPersonMatrixIdentityPrefForList,
  isPersonMatrixIdentityColumnId,
  normalizePersonMatrixIdentityByList,
  normalizePersonMatrixIdentityColumns,
  personMatrixIdentityColumnsEqual,
  reorderPersonMatrixIdentityColumns,
  setPersonMatrixIdentityColumnHidden,
  type PersonMatrixIdentityColumnId,
  type PersonMatrixIdentityColumnsPref,
  type PersonMatrixIdentityByList,
} from '../utils/personMatrixIdentityColumns';
import { GarmentListCustomColumnsSettingsSection } from './GarmentListCustomColumnsSettingsSection';

export type GarmentsListsSettingsCategory = 'customColumns';

const IDENTITY_LABEL_KEYS: Record<PersonMatrixIdentityColumnId, string> = {
  name: 'garments.personName',
  team: 'garments.team',
  jerseyName: 'garments.jerseyName',
  initials: 'garments.initials',
  jerseyNumber: 'garments.jerseyNumber',
};

interface GarmentsListsSettingsViewProps {
  selectedCategory?: GarmentsListsSettingsCategory;
  onSelectedCategoryChange?: (category: GarmentsListsSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
  /** Pre-select a list when opening settings from list context. */
  initialListId?: string | null;
}

function editableColumnsFromList(
  list: { checkboxColumns?: GarmentCheckboxColumn[] } | null,
): GarmentCheckboxColumn[] {
  return listEditablePersonCheckboxColumns(
    list?.checkboxColumns?.length ? list.checkboxColumns : createDefaultCheckboxColumns(),
  );
}

export function GarmentsListsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
  initialListId = null,
}: GarmentsListsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { garmentLists, updateListCheckboxColumns } = useGarments();

  const [internalCategory, setInternalCategory] =
    useState<GarmentsListsSettingsCategory>('customColumns');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [selectedListId, setSelectedListId] = useState<string>(() => {
    if (initialListId && garmentLists.some((list) => list.id === initialListId)) {
      return initialListId;
    }
    return garmentLists[0]?.id ?? '';
  });

  const selectedList = useMemo(
    () => garmentLists.find((list) => list.id === selectedListId) ?? null,
    [garmentLists, selectedListId],
  );

  const [draftPersonColumns, setDraftPersonColumns] = useState<GarmentCheckboxColumn[]>(() =>
    editableColumnsFromList(selectedList),
  );
  const [initialPersonColumns, setInitialPersonColumns] = useState<GarmentCheckboxColumn[]>(() =>
    editableColumnsFromList(selectedList),
  );
  const [identityColumns, setIdentityColumns] = useState<PersonMatrixIdentityColumnsPref>(() =>
    normalizePersonMatrixIdentityColumns(null),
  );
  const [initialIdentityColumns, setInitialIdentityColumns] =
    useState<PersonMatrixIdentityColumnsPref>(() => normalizePersonMatrixIdentityColumns(null));
  const [identityByList, setIdentityByList] = useState<PersonMatrixIdentityByList>(() =>
    normalizePersonMatrixIdentityByList(null),
  );
  /** False until getSettings resolves (success or empty fallback). Blocks identity persist. */
  const [identitySettingsLoaded, setIdentitySettingsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const prevListIdRef = useRef<string | null>(null);
  const personDirtyRef = useRef(false);
  const identityDirtyRef = useRef(false);

  personDirtyRef.current = !personCheckboxColumnsEqual(draftPersonColumns, initialPersonColumns);
  identityDirtyRef.current = !personMatrixIdentityColumnsEqual(
    identityColumns,
    initialIdentityColumns,
  );

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'customColumns',
        label: t('garments.settingsCategories.customColumns'),
        description: t('garments.settingsCategories.customColumnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!selectedListId && garmentLists[0]?.id) {
      setSelectedListId(garmentLists[0].id);
    }
  }, [garmentLists, selectedListId]);

  useEffect(() => {
    let cancelled = false;
    setIdentitySettingsLoaded(false);
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setIdentityByList(
          normalizePersonMatrixIdentityByList(settings?.personMatrixIdentityByList),
        );
        setIdentitySettingsLoaded(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // Do not mark loaded — identity save must not overwrite server map with {}.
        setIdentitySettingsLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!selectedList) {
      prevListIdRef.current = null;
      const empty = editableColumnsFromList(null);
      setDraftPersonColumns(empty);
      setInitialPersonColumns(empty);
      const identity = normalizePersonMatrixIdentityColumns(null);
      setIdentityColumns(identity);
      setInitialIdentityColumns(identity);
      setSaveError(null);
      return;
    }

    const listChanged = prevListIdRef.current !== selectedList.id;
    prevListIdRef.current = selectedList.id;

    if (listChanged || !personDirtyRef.current) {
      const next = editableColumnsFromList(selectedList);
      setDraftPersonColumns(next);
      setInitialPersonColumns(next);
    }

    if (identitySettingsLoaded && (listChanged || !identityDirtyRef.current)) {
      const identity = getPersonMatrixIdentityPrefForList(
        { personMatrixIdentityByList: identityByList },
        selectedList.id,
      );
      setIdentityColumns(identity);
      setInitialIdentityColumns(identity);
    }

    if (listChanged) {
      setSaveError(null);
    }
  }, [selectedList, identityByList, identitySettingsLoaded]);

  const personDirty = personDirtyRef.current;
  const identityDirty = identityDirtyRef.current;
  const isDirty =
    activeCategory === 'customColumns' && selectedList != null && (personDirty || identityDirty);

  const handleSave = useCallback(async () => {
    if (!selectedList || activeCategory !== 'customColumns') {
      return;
    }
    const checkboxDirty = !personCheckboxColumnsEqual(draftPersonColumns, initialPersonColumns);
    const identityDirtyNow = !personMatrixIdentityColumnsEqual(
      identityColumns,
      initialIdentityColumns,
    );
    if (!checkboxDirty && !identityDirtyNow) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    let checkboxFailed = false;
    let identityFailed = false;
    let identityNotReady = false;

    try {
      if (checkboxDirty) {
        const sourceColumns =
          selectedList.checkboxColumns?.length > 0
            ? selectedList.checkboxColumns
            : createDefaultCheckboxColumns();
        const next = applyPersonCheckboxColumnDraft(sourceColumns, draftPersonColumns);
        const ok = await updateListCheckboxColumns(selectedList.id, next);
        if (ok) {
          const savedDraft = listEditablePersonCheckboxColumns(next);
          setDraftPersonColumns(savedDraft);
          setInitialPersonColumns(savedDraft);
        } else {
          checkboxFailed = true;
        }
      }

      if (identityDirtyNow) {
        if (!identitySettingsLoaded) {
          identityNotReady = true;
        } else {
          try {
            const normalizedIdentity = normalizePersonMatrixIdentityColumns(identityColumns);
            const nextByList = {
              ...identityByList,
              [selectedList.id]: normalizedIdentity,
            };
            await updateSettings(GARMENTS_SETTINGS_KEY, {
              personMatrixIdentityByList: nextByList,
            });
            setIdentityByList(nextByList);
            setIdentityColumns(normalizedIdentity);
            setInitialIdentityColumns(normalizedIdentity);
          } catch (error) {
            console.error('Failed to save garment identity columns:', error);
            identityFailed = true;
          }
        }
      }

      if (checkboxFailed || identityFailed) {
        setSaveError(t('garments.customColumnsSaveFailed'));
      } else if (identityNotReady) {
        setSaveError(t('garments.customColumnsSettingsNotReady'));
      }
    } catch (error) {
      console.error('Failed to save garment list person columns:', error);
      setSaveError(t('garments.customColumnsSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [
    activeCategory,
    draftPersonColumns,
    identityByList,
    identityColumns,
    identitySettingsLoaded,
    initialIdentityColumns,
    initialPersonColumns,
    selectedList,
    t,
    updateListCheckboxColumns,
    updateSettings,
  ]);

  const totalColumnCount = useMemo(() => {
    if (!selectedList) {
      return draftPersonColumns.length;
    }
    const source =
      selectedList.checkboxColumns?.length > 0
        ? selectedList.checkboxColumns
        : createDefaultCheckboxColumns();
    return applyPersonCheckboxColumnDraft(source, draftPersonColumns).length;
  }, [draftPersonColumns, selectedList]);

  return (
    <PluginSettingsPageShell
      title={t('garments.settingsLists')}
      subtitle={t('garments.settingsListsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as GarmentsListsSettingsCategory)}
      onClose={onClose}
      onSave={isDirty ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSave()}
            isSaving={isSaving}
            label={t('common.save')}
            savingLabel={t('common.saving')}
          />
        ) : null
      }
    >
      {activeCategory === 'customColumns' && (
        <div className="space-y-6">
          <DetailSection
            title={t('garments.settingsCategories.customColumnsList')}
            className="pt-0"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('garments.settingsCategories.customColumnsListHint')}
              </p>
              {garmentLists.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('garments.noListsYet')}</p>
              ) : (
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger
                    className="max-w-md"
                    aria-label={t('garments.settingsCategories.customColumnsList')}
                  >
                    <SelectValue
                      placeholder={t('garments.settingsCategories.customColumnsListPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {garmentLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name || '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DetailSection>

          {selectedList ? (
            <>
              <TableColumnsSettingsSection
                title={t('garments.settingsCategories.identityColumns')}
                hint={t('garments.settingsCategories.identityColumnsHint')}
                pref={identityColumns}
                requiredColumnId="name"
                labelFor={(id) => t(IDENTITY_LABEL_KEYS[id])}
                isColumnId={isPersonMatrixIdentityColumnId}
                reorder={reorderPersonMatrixIdentityColumns}
                setHidden={setPersonMatrixIdentityColumnHidden}
                onChange={setIdentityColumns}
              />
              <GarmentListCustomColumnsSettingsSection
                title={t('garments.settingsCategories.customColumns')}
                hint={t('garments.settingsCategories.customColumnsHint')}
                totalColumnCount={totalColumnCount}
                columns={draftPersonColumns}
                onChange={setDraftPersonColumns}
              />
              {saveError ? (
                <p role="status" className="text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </PluginSettingsPageShell>
  );
}
