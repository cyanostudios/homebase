import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useCups } from '../context/CupsContext';
import type { Cup } from '../types/cup';

const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLASS = 'h-10 text-sm';

export const CupForm: React.FC = () => {
  const { t } = useTranslation();
  const { currentCup, panelMode, saveCup, closeCupPanel } = useCups();

  const isCreate = panelMode === 'create';

  const [form, setForm] = useState<Partial<Cup>>({
    name: '',
    organizer: '',
    region: '',
    location: '',
    sport_type: 'football',
    start_date: '',
    end_date: '',
    age_groups: '',
    registration_url: '',
    source_url: '',
    raw_snippet: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCup && !isCreate) {
      setForm({
        name: currentCup.name ?? '',
        organizer: currentCup.organizer ?? '',
        region: currentCup.region ?? '',
        location: currentCup.location ?? '',
        sport_type: currentCup.sport_type ?? 'football',
        start_date: currentCup.start_date ?? '',
        end_date: currentCup.end_date ?? '',
        age_groups: currentCup.age_groups ?? '',
        registration_url: currentCup.registration_url ?? '',
        source_url: currentCup.source_url ?? '',
        raw_snippet: currentCup.raw_snippet ?? '',
      });
    }
  }, [currentCup, isCreate]);

  const set = (key: keyof Cup) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!form.name?.trim()) {
      return;
    }

    const toNullIfEmpty = (value: unknown) => {
      const s =
        typeof value === 'string' ? value.trim() : value !== null ? String(value).trim() : '';
      return s.length ? s : null;
    };

    const payload: Partial<Cup> = {
      ...form,
      name: (form.name ?? '').trim(),
      organizer: toNullIfEmpty(form.organizer),
      region: toNullIfEmpty(form.region),
      location: toNullIfEmpty(form.location),
      start_date: toNullIfEmpty(form.start_date),
      end_date: toNullIfEmpty(form.end_date),
      age_groups: toNullIfEmpty(form.age_groups),
      registration_url: toNullIfEmpty(form.registration_url),
      source_url: toNullIfEmpty(form.source_url),
      raw_snippet: toNullIfEmpty(form.raw_snippet),
    };

    setSaving(true);
    const ok = await saveCup(payload);
    setSaving(false);
    if (ok && isCreate) {
      closeCupPanel();
    }
  }, [saving, form, saveCup, isCreate, closeCupPanel]);

  const handleCancel = useCallback(() => {
    closeCupPanel();
  }, [closeCupPanel]);

  useEffect(() => {
    window.submitCupsForm = () => {
      void handleSubmit();
    };
    // Fallback aliases in case panel handler resolves singular plugin key
    (window as any).submitCupForm = window.submitCupsForm;
    window.cancelCupsForm = handleCancel;
    (window as any).cancelCupForm = window.cancelCupsForm;
    return () => {
      delete window.submitCupsForm;
      delete (window as any).submitCupForm;
      delete window.cancelCupsForm;
      delete (window as any).cancelCupForm;
    };
  }, [handleSubmit, handleCancel]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="flex flex-col gap-4 p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label className={FIELD_LABEL_CLASS}>{t('cups.name')} *</Label>
        <Input
          className={INPUT_CLASS}
          value={form.name ?? ''}
          onChange={set('name')}
          placeholder={t('cups.namePlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.startDate')}</Label>
          <Input
            className={INPUT_CLASS}
            type="date"
            value={form.start_date ?? ''}
            onChange={set('start_date')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.endDate')}</Label>
          <Input
            className={INPUT_CLASS}
            type="date"
            value={form.end_date ?? ''}
            onChange={set('end_date')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.region')}</Label>
          <Input
            className={INPUT_CLASS}
            value={form.region ?? ''}
            onChange={set('region')}
            placeholder={t('cups.regionPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.location')}</Label>
          <Input
            className={INPUT_CLASS}
            value={form.location ?? ''}
            onChange={set('location')}
            placeholder={t('cups.locationPlaceholder')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.organizer')}</Label>
          <Input
            className={INPUT_CLASS}
            value={form.organizer ?? ''}
            onChange={set('organizer')}
            placeholder={t('cups.organizerPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL_CLASS}>{t('cups.ageGroups')}</Label>
          <Input
            className={INPUT_CLASS}
            value={form.age_groups ?? ''}
            onChange={set('age_groups')}
            placeholder={t('cups.ageGroupsPlaceholder')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={FIELD_LABEL_CLASS}>{t('cups.registrationUrl')}</Label>
        <Input
          className={INPUT_CLASS}
          type="url"
          value={form.registration_url ?? ''}
          onChange={set('registration_url')}
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={FIELD_LABEL_CLASS}>{t('cups.source')}</Label>
        <Input
          className={INPUT_CLASS}
          type="url"
          value={form.source_url ?? ''}
          onChange={set('source_url')}
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={FIELD_LABEL_CLASS}>{t('cups.scrapedContent')}</Label>
        <Textarea
          value={form.raw_snippet ?? ''}
          onChange={set('raw_snippet')}
          className="min-h-[180px] resize-y text-sm leading-relaxed"
          placeholder={t('cups.rawInfo')}
        />
      </div>
    </form>
  );
};
