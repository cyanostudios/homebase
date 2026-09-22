import { Download, History, Info, SlidersHorizontal, Star, Trash2, Trophy } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DatePicker, formatDateInputValue, parseDateInputValue } from '@/core/ui/DatePicker';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_GHOST_INPUT_CLASS, FORM_GHOST_TEXTAREA_CLASS } from '@/core/ui/formFieldStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { filesApi } from '@/plugins/files/api/filesApi';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

import { CupPropertiesFields } from './CupPropertiesFields';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Persisted timestamps (UTC ISO etc.) → local calendar YYYY-MM-DD for DatePicker. */
function cupTimestampToDateInputValue(raw: string): string {
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type CupFormTab = 'information' | 'ratings' | 'ingest' | 'activity';

const CUP_FORM_TABS: CupFormTab[] = ['information', 'ratings', 'ingest', 'activity'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const CUP_FORM_EDIT_DISABLED_TABS: ReadonlySet<CupFormTab> = new Set([
  'ratings',
  'ingest',
  'activity',
]);

function parseCupFormTab(value: string | null): CupFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && CUP_FORM_TABS.includes(value as CupFormTab)) {
    return value as CupFormTab;
  }
  return 'information';
}

type Props = {
  currentCup?: Cup | null;
  currentItem?: Cup | null;
  onSave: (data: Partial<Cup> & { name: string }) => Promise<boolean>;
  onCancel: () => void;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
  /** Close/Update rendered in the header card title row — matches view chrome. */
  headerTrailing?: React.ReactNode;
};

export const CupForm = React.forwardRef<PanelFormHandle, Props>(function CupForm(
  { currentCup, currentItem, onSave, onCancel, stacked = false, headerTrailing },
  ref,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseCupFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: CupFormTab, replace = false) => {
      if (CUP_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!CUP_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

  const { validationErrors, clearValidationErrors } = useCups();
  const item = currentCup ?? currentItem ?? null;
  const [form, setForm] = useState({
    name: '',
    organizer: '',
    location: '',
    start_date: '',
    end_date: '',
    categories: '',
    team_count: '' as string,
    match_format: '',
    registration_url: '',
    source_url: '',
    description: '',
    visible: true,
    sanctioned: true,
    featured: false,
    featured_image_url: '',
  });
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  useEffect(() => {
    const formKey = `cup-form-${item?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [item?.id, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    setForm({
      name: item?.name || '',
      organizer: item?.organizer || '',
      location: item?.location || '',
      start_date: item?.start_date ? cupTimestampToDateInputValue(String(item.start_date)) : '',
      end_date: item?.end_date ? cupTimestampToDateInputValue(String(item.end_date)) : '',
      categories: item?.categories || '',
      team_count:
        item?.team_count !== null && item?.team_count !== undefined ? String(item.team_count) : '',
      match_format: item?.match_format || '',
      registration_url: item?.registration_url || '',
      source_url: item?.source_url || '',
      description: item?.description || '',
      visible: item?.visible !== false,
      sanctioned: item?.sanctioned !== false,
      featured: item?.featured === true,
      featured_image_url: item?.featured_image_url || '',
    });
    setImageUploadError(null);
    clearValidationErrors();
    markClean();
  }, [item, clearValidationErrors, markClean]);

  const onFieldChange = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (validationErrors.length) {
      clearValidationErrors();
    }
    markDirty();
  };

  const normalizeDateForApi = (value: string): string | null => {
    const v = String(value || '').trim();
    if (!v) {
      return null;
    }
    return v;
  };

  const submit = useCallback(async () => {
    const ok = await onSave({
      ...form,
      name: form.name.trim(),
      organizer: form.organizer || null,
      location: form.location || null,
      start_date: normalizeDateForApi(form.start_date),
      end_date: normalizeDateForApi(form.end_date),
      categories: form.categories || null,
      team_count: form.team_count.trim() ? Number(form.team_count) : null,
      match_format: form.match_format || null,
      featured: form.featured,
      visible: form.visible,
      sanctioned: form.sanctioned,
      registration_url: form.registration_url || null,
      source_url: form.source_url || null,
      description: form.description || null,
      featured_image_url: form.featured_image_url.trim() || null,
    });
    if (ok) {
      markClean();
    }
  }, [form, markClean, onSave]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => submit(),
      cancel: () => attemptAction(onCancel, { force: true }),
    }),
    [submit, attemptAction, onCancel],
  );

  const tabs = useMemo(
    () => [
      { id: 'information' as const, label: t('cups.tabs.information'), icon: Info },
      { id: 'ratings' as const, label: t('cups.tabs.ratings'), icon: Star },
      { id: 'ingest' as const, label: t('cups.tabs.ingest'), icon: Download },
      { id: 'activity' as const, label: t('cups.tabs.activity'), icon: History },
    ],
    [t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = CUP_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('cups.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon icon={Trophy} />
          </span>
          <div className="min-w-0 flex-1">
            <Input
              value={form.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              placeholder="Name"
              aria-label="Name"
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          {headerTrailing ? (
            <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
          ) : null}
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title="Cup information" icon={Trophy} subtleTitle className="p-6">
        <div className={cn('grid grid-cols-1 gap-3', !stacked && 'md:grid-cols-2')}>
          <div className={cn(!stacked && 'md:col-span-2')}>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                onFieldChange('name', e.target.value);
              }}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Organizer</Label>
            <Input
              value={form.organizer}
              onChange={(e) => {
                onFieldChange('organizer', e.target.value);
              }}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => {
                onFieldChange('location', e.target.value);
              }}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Start date</Label>
            <DatePicker
              value={parseDateInputValue(form.start_date)}
              onChange={(date) => onFieldChange('start_date', formatDateInputValue(date))}
              placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
              clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
              variant="filled"
              fullWidth
            />
          </div>
          <div>
            <Label>End date</Label>
            <DatePicker
              value={parseDateInputValue(form.end_date)}
              onChange={(date) => onFieldChange('end_date', formatDateInputValue(date))}
              placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
              clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
              variant="filled"
              fullWidth
            />
          </div>
          <div className={cn(!stacked && 'md:col-span-2')}>
            <Label>Categories</Label>
            <Input
              value={form.categories}
              onChange={(e) => {
                onFieldChange('categories', e.target.value);
              }}
              placeholder="comma separated"
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Match format</Label>
            <Input
              value={form.match_format}
              onChange={(e) => {
                onFieldChange('match_format', e.target.value);
              }}
              placeholder="e.g. 5 vs 5"
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Teams</Label>
            <Input
              type="number"
              min={0}
              value={form.team_count}
              onChange={(e) => {
                onFieldChange('team_count', e.target.value);
              }}
              placeholder="team count"
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Registration URL</Label>
            <Input
              value={form.registration_url}
              onChange={(e) => {
                onFieldChange('registration_url', e.target.value);
              }}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div>
            <Label>Source URL</Label>
            <Input
              value={form.source_url}
              onChange={(e) => {
                onFieldChange('source_url', e.target.value);
              }}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          <div className={cn(!stacked && 'md:col-span-2')}>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => {
                onFieldChange('description', e.target.value);
              }}
              rows={6}
              className={FORM_GHOST_TEXTAREA_CLASS}
            />
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const propertiesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('cups.cupProperties')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <CupPropertiesFields
          variant="form"
          values={{
            visible: form.visible,
            sanctioned: form.sanctioned,
            featured: form.featured,
          }}
          onVisibleChange={(value) => onFieldChange('visible', value)}
          onSanctionedChange={(value) => onFieldChange('sanctioned', value)}
          onFeaturedChange={(value) => onFieldChange('featured', value)}
        />
        <div className="mt-4 space-y-2 rounded-lg border border-border p-4">
          <div>
            <Label>Hero image (Cupappen featured cards)</Label>
            <p className="text-xs text-muted-foreground">
              Upload a cover image for the featured card. If empty, a default photo is used on the
              public site.
            </p>
          </div>
          {form.featured_image_url ? (
            <div className="flex flex-wrap items-end gap-3">
              <img
                src={form.featured_image_url}
                alt=""
                className="h-24 w-40 rounded-md object-cover border border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  onFieldChange('featured_image_url', '');
                }}
              >
                Remove image
              </Button>
            </div>
          ) : null}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={imageUploadBusy}
            className={cn(FORM_GHOST_INPUT_CLASS, 'cursor-pointer')}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) {
                return;
              }
              setImageUploadError(null);
              setImageUploadBusy(true);
              try {
                const items = await filesApi.uploadFiles([file]);
                const url = items[0]?.url;
                if (url) {
                  onFieldChange('featured_image_url', url);
                } else {
                  setImageUploadError('No file URL returned');
                }
              } catch {
                setImageUploadError('Upload failed');
              } finally {
                setImageUploadBusy(false);
              }
            }}
          />
          {imageUploadBusy ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
          {imageUploadError ? <p className="text-xs text-destructive">{imageUploadError}</p> : null}
        </div>
      </DetailSection>
    </Card>
  );

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="space-y-3">
          {formHeader}
          {activeTab === 'information' ? informationCard : null}
          {activeTab === 'information' ? propertiesCard : null}
        </div>
      </DetailLayout>
      {validationErrors.length > 0 && (
        <Card padding="sm" className="mt-3 border-destructive/40 bg-destructive/5">
          <ul className="text-sm text-destructive space-y-1">
            {validationErrors.map((e) => (
              <li key={`${e.field}:${e.message}`}>{e.message}</li>
            ))}
          </ul>
        </Card>
      )}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved changes"
        message="You have unsaved changes. Discard them?"
        confirmText="Discard"
        cancelText="Continue editing"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
