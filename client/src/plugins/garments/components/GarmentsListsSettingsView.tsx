import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { useGarments } from '../hooks/useGarments';
import type { GarmentCheckboxColumn } from '../types/garments';
import {
  applyPersonCheckboxColumnDraft,
  listEditablePersonCheckboxColumns,
  personCheckboxColumnsEqual,
} from '../utils/customCheckboxColumns';
import { createDefaultCheckboxColumns } from '../utils/defaultCheckboxTemplate';
import { GarmentListCustomColumnsSettingsSection } from './GarmentListCustomColumnsSettingsSection';

export type GarmentsListsSettingsCategory = 'customColumns';

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const prevListIdRef = useRef<string | null>(null);
  const personDirtyRef = useRef(false);

  personDirtyRef.current = !personCheckboxColumnsEqual(draftPersonColumns, initialPersonColumns);

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
    if (!selectedList) {
      prevListIdRef.current = null;
      const empty = editableColumnsFromList(null);
      setDraftPersonColumns(empty);
      setInitialPersonColumns(empty);
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

    if (listChanged) {
      setSaveError(null);
    }
  }, [selectedList]);

  const personDirty = personDirtyRef.current;
  const isDirty = activeCategory === 'customColumns' && selectedList != null && personDirty;

  const handleSave = useCallback(async () => {
    if (!selectedList || activeCategory !== 'customColumns') {
      return;
    }
    const checkboxDirty = !personCheckboxColumnsEqual(draftPersonColumns, initialPersonColumns);
    if (!checkboxDirty) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
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
        setSaveError(t('garments.customColumnsSaveFailed'));
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
    initialPersonColumns,
    selectedList,
    t,
    updateListCheckboxColumns,
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
