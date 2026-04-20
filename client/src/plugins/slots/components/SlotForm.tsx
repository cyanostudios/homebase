import { Info, Search, SlidersHorizontal, Trash2, User, Users } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DateTimePicker } from '@/core/ui/DateTimePicker';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useSlotsContext as useSlots } from '../context/SlotsContext';
import { CAPACITY_OPTIONS, type SlotMention } from '../types/slots';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { SlotsSettingsForm } from './SlotsSettingsForm';

const SLOT_FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

interface SlotFormState {
  name: string;
  slot_time: string;
  slot_end: string;
  location: string;
  address: string;
  category: string;
  capacity: number;
  visible: boolean;
  notifications_enabled: boolean;
  description: string;
}

interface SlotFormBaseline {
  formData: SlotFormState;
  selectedContactIds: string[];
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
];

const GAP_OPTIONS = [
  { value: 0, label: '0 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
];

interface SlotFormProps {
  currentSlot?: {
    id: string;
    name?: string | null;
    slot_time: string;
    slot_end?: string | null;
    location: string | null;
    address?: string | null;
    category?: string | null;
    capacity: number;
    visible: boolean;
    notifications_enabled: boolean;
    contact_id?: string | null;
    mentions?: SlotMention[];
    description?: string | null;
    created_at?: string;
    updated_at?: string;
  } | null;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  onSaveSlots?: (dataArray: Record<string, unknown>[]) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Convert an ISO timestamp (UTC or local) to a "YYYY-MM-DDTHH:mm" string
 * expressed in the browser's local timezone, suitable for date/time inputs.
 *
 * The DB stores `timestamp without time zone`; the pg driver adds a Z when
 * serialising, so the value arrives as UTC. We display in local time so that
 * what the user picks in the form matches what they see in the view.
 */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

export const SlotForm = React.forwardRef<PanelFormHandle, SlotFormProps>(function SlotForm(
  { currentSlot, onSave, onSaveSlots, onCancel },
  ref,
) {
  const { t } = useTranslation();
  const { contacts, getSettings, settingsVersion } = useApp();
  const { validationErrors, clearValidationErrors, panelMode } = useSlots();
  const assignableContacts = contacts.filter(
    (c: { isAssignable?: boolean }) => c.isAssignable !== false,
  );
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [formData, setFormData] = useState<SlotFormState>({
    name: '',
    slot_time: '',
    slot_end: '',
    location: '',
    address: '',
    category: '',
    capacity: 1,
    visible: true,
    notifications_enabled: true,
    description: '',
  });
  /** Selected contact IDs for this slot (multiple contacts). */
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  /** Add-contact UX aligned with SlotView (search + popover). */
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);

  const addableContactsForForm = useMemo(
    () =>
      assignableContacts.filter(
        (c: { id: number | string }) => !selectedContactIds.includes(String(c.id)),
      ),
    [assignableContacts, selectedContactIds],
  );
  const filteredContactSuggestions = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return addableContactsForForm;
    }
    return addableContactsForForm.filter((contact) => {
      const c = contact as {
        companyName?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        phone2?: string;
      };
      const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
      return [c.companyName, c.name, fullName, c.email, c.phone, c.phone2]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [addableContactsForForm, contactSearch]);

  /** Series mode: generate multiple slots from start time + duration + gap */
  const [isSeries, setIsSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [gapMinutes, setGapMinutes] = useState(30);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedSlotIdRef = useRef<string | null>(null);
  const baselineRef = useRef<SlotFormBaseline>({
    formData: {
      name: '',
      slot_time: '',
      slot_end: '',
      location: '',
      address: '',
      category: '',
      capacity: 1,
      visible: true,
      notifications_enabled: true,
      description: '',
    },
    selectedContactIds: [],
  });

  const hasActualChanges = useCallback(() => {
    const normalizeIds = (ids: string[]) => [...ids].map(String).sort();
    const sameFormData = JSON.stringify(formData) === JSON.stringify(baselineRef.current.formData);
    const sameContacts =
      JSON.stringify(normalizeIds(selectedContactIds)) ===
      JSON.stringify(normalizeIds(baselineRef.current.selectedContactIds));
    return !(sameFormData && sameContacts);
  }, [formData, selectedContactIds]);

  useEffect(() => {
    let cancelled = false;
    getSettings('slots')
      .then((settings: { tags?: unknown[] }) => {
        if (cancelled) {
          return;
        }
        const tags = Array.isArray(settings?.tags)
          ? settings.tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];
        setAvailableCategories(tags);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableCategories([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    const formKey = `slot-form-${currentSlot?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => hasActualChanges());
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [
    currentSlot,
    hasActualChanges,
    registerUnsavedChangesChecker,
    unregisterUnsavedChangesChecker,
  ]);

  const resetForm = useCallback(() => {
    const nextFormData: SlotFormState = {
      name: '',
      slot_time: '',
      slot_end: '',
      location: '',
      address: '',
      category: '',
      capacity: 1,
      visible: true,
      notifications_enabled: true,
      description: '',
    };
    setFormData(nextFormData);
    setSelectedContactIds([]);
    baselineRef.current = { formData: nextFormData, selectedContactIds: [] };
    setIsSeries(false);
    setSeriesCount(2);
    setDurationMinutes(60);
    setGapMinutes(30);
    markClean();
  }, [markClean]);

  const generatedTimes = useMemo(() => {
    if (!isSeries || !formData.slot_time) {
      return [];
    }
    const startMs = new Date(formData.slot_time).getTime();
    const intervalMs = (durationMinutes + gapMinutes) * 60_000;
    return Array.from({ length: seriesCount }, (_, i) => new Date(startMs + i * intervalMs));
  }, [isSeries, formData.slot_time, seriesCount, durationMinutes, gapMinutes]);
  const categoryOptions = useMemo(() => {
    const current = formData.category.trim();
    if (!current || availableCategories.includes(current)) {
      return availableCategories;
    }
    return [current, ...availableCategories];
  }, [availableCategories, formData.category]);

  useEffect(() => {
    if (currentSlot) {
      // Prevent resetting controlled inputs on every re-render while editing same slot.
      if (initializedSlotIdRef.current === currentSlot.id) {
        return;
      }
      initializedSlotIdRef.current = currentSlot.id;

      const nextFormData: SlotFormState = {
        name: currentSlot.name ?? '',
        slot_time: toDatetimeLocal(currentSlot.slot_time),
        slot_end: currentSlot.slot_end ? toDatetimeLocal(currentSlot.slot_end) : '',
        location: currentSlot.location ?? '',
        address: currentSlot.address ?? '',
        category: currentSlot.category ?? '',
        capacity: currentSlot.capacity,
        visible: currentSlot.visible,
        notifications_enabled: currentSlot.notifications_enabled,
        description: currentSlot.description ?? '',
      };
      setFormData(nextFormData);
      const fromMentions =
        currentSlot.mentions?.map((m) => String(m.contactId)).filter(Boolean) ?? [];
      const fromContactId =
        currentSlot.contact_id && !fromMentions.includes(String(currentSlot.contact_id))
          ? [String(currentSlot.contact_id)]
          : [];
      const nextSelectedContactIds = fromMentions.length > 0 ? fromMentions : fromContactId;
      setSelectedContactIds(nextSelectedContactIds);
      baselineRef.current = { formData: nextFormData, selectedContactIds: nextSelectedContactIds };
      markClean();
    } else if (panelMode !== 'settings') {
      initializedSlotIdRef.current = null;
      resetForm();
    }
  }, [currentSlot, panelMode, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (panelMode === 'settings') {
      onCancel();
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const mentions: SlotMention[] = selectedContactIds
      .map((id) => assignableContacts.find((c: { id: number | string }) => String(c.id) === id))
      .filter(Boolean)
      .map((c: { id: number | string; companyName?: string }) => ({
        contactId: String(c.id),
        contactName: c.companyName ?? 'Contact',
        companyName: c.companyName,
      }));

    if (isSeries && onSaveSlots && generatedTimes.length > 0) {
      const payloads = generatedTimes.map((date) => ({
        name: formData.name.trim() || null,
        location: formData.location.trim() || null,
        address: formData.address.trim() || null,
        category: formData.category.trim() || null,
        slot_time: date.toISOString(),
        slot_end: formData.slot_end ? new Date(formData.slot_end).toISOString() : null,
        capacity: formData.capacity,
        visible: formData.visible,
        notifications_enabled: formData.notifications_enabled,
        contact_id: selectedContactIds[0] ?? null,
        mentions,
        description: formData.description.trim() || null,
      }));
      try {
        const ok = await onSaveSlots(payloads);
        if (ok) {
          markClean();
          resetForm();
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim() || null,
      slot_time: formData.slot_time ? new Date(formData.slot_time).toISOString() : '',
      slot_end: formData.slot_end ? new Date(formData.slot_end).toISOString() : null,
      location: formData.location.trim() || null,
      address: formData.address.trim() || null,
      category: formData.category.trim() || null,
      contact_id: selectedContactIds[0] ?? null,
      mentions,
      description: formData.description.trim() || null,
    };
    try {
      const ok = await onSave(payload);
      if (ok) {
        markClean();
        if (!currentSlot) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    panelMode,
    formData,
    selectedContactIds,
    assignableContacts,
    onSave,
    onSaveSlots,
    onCancel,
    markClean,
    currentSlot,
    resetForm,
    isSeries,
    generatedTimes,
    isSubmitting,
  ]);

  const handleCancel = useCallback(() => {
    if (!hasActualChanges()) {
      onCancel();
      return;
    }
    attemptAction(() => onCancel());
  }, [attemptAction, hasActualChanges, onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  if (panelMode === 'settings') {
    return <SlotsSettingsForm onCancel={onCancel} />;
  }

  const updateField = <K extends keyof SlotFormState>(field: K, value: SlotFormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const endBeforeStartError =
    formData.slot_end && formData.slot_time
      ? new Date(formData.slot_end).getTime() <= new Date(formData.slot_time).getTime()
        ? t('slots.endMustBeAfterStart')
        : null
      : null;

  const hasBlockingErrors =
    !!endBeforeStartError ||
    validationErrors.some((e) => !e.message?.toLowerCase().includes('warning'));

  const formSidebar = currentSlot ? (
    <div className="space-y-4">
      <Card padding="none" className={SLOT_FORM_CARD_CLASS}>
        <DetailSection
          title={t('slots.information')}
          icon={Info}
          iconPlugin="slots"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('slots', currentSlot.id)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {currentSlot.created_at
                  ? new Date(currentSlot.created_at).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">
                {currentSlot.updated_at
                  ? new Date(currentSlot.updated_at).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
      <DetailActivityLog entityType="slot" entityId={currentSlot.id} title={t('slots.activity')} />
    </div>
  ) : undefined;

  return (
    <>
      <div
        className={cn(
          'plugin-slots min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm text-destructive font-medium">{t('common.cannotSave')}</div>
                <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
                  {validationErrors
                    .filter((e) => !e.message?.toLowerCase().includes('warning'))
                    .map((e) => (
                      <li key={`${e.field}-${e.message}`}>{e.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            {!currentSlot && onSaveSlots && (
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('slots.generateSeries')}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('slots.generateSeriesHelp')}
                  </p>
                </div>
                <Switch checked={isSeries} onCheckedChange={setIsSeries} />
              </div>
            )}

            {!currentSlot && isSeries && onSaveSlots && (
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="series-count">{t('slots.numberOfSlots')}</Label>
                    <Input
                      id="series-count"
                      type="number"
                      min={2}
                      max={20}
                      value={seriesCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) {
                          setSeriesCount(Math.min(20, Math.max(2, v)));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="series-duration">{t('slots.durationPerSlot')}</Label>
                    <Select
                      value={String(durationMinutes)}
                      onValueChange={(v) => setDurationMinutes(parseInt(v, 10))}
                    >
                      <SelectTrigger id="series-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="series-gap">{t('slots.gapBetweenSlots')}</Label>
                    <Select
                      value={String(gapMinutes)}
                      onValueChange={(v) => setGapMinutes(parseInt(v, 10))}
                    >
                      <SelectTrigger id="series-gap">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GAP_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {generatedTimes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">{t('slots.preview')}</Label>
                    <ul className="text-sm text-muted-foreground border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                      {generatedTimes.map((d) => (
                        <li key={d.toISOString()} className="px-3 py-2">
                          {d.toLocaleString('sv-SE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            <Card padding="none" className={SLOT_FORM_CARD_CLASS}>
              <DetailSection title={t('slots.sectionTitle')} iconPlugin="slots" className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slots-name">{t('slots.nameLabel')}</Label>
                    <Input
                      id="slots-name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder={t('slots.namePlaceholder')}
                    />
                  </div>
                  {/* Start / end (same combined date+time UI as matches DateTimePicker) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slots-start-datetime">{t('slots.dateTimeStart')}</Label>
                      <DateTimePicker
                        value={formData.slot_time}
                        onChange={(v) => updateField('slot_time', v)}
                        hasError={Boolean(getFieldError('slot_time'))}
                        placeholder={t('slots.dateTimePlaceholder')}
                        timeLabel={t('slots.dateTimePickerTime')}
                        clearLabel={t('slots.dateTimeClear')}
                      />
                      {getFieldError('slot_time') && (
                        <p className="text-sm text-destructive">
                          {getFieldError('slot_time')!.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slots-end-datetime">{t('slots.dateTimeEnd')}</Label>
                      <DateTimePicker
                        value={formData.slot_end}
                        onChange={(v) => updateField('slot_end', v)}
                        hasError={Boolean(getFieldError('slot_end'))}
                        placeholder={t('slots.dateTimePlaceholder')}
                        timeLabel={t('slots.dateTimePickerTime')}
                        clearLabel={t('slots.dateTimeClear')}
                      />
                    </div>
                  </div>
                  {endBeforeStartError && (
                    <p className="text-sm text-destructive">{endBeforeStartError}</p>
                  )}
                  {getFieldError('slot_end') && !endBeforeStartError && (
                    <p className="text-sm text-destructive">{getFieldError('slot_end')!.message}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="slots-location">{t('slots.locationLabel')}</Label>
                    <Input
                      id="slots-location"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder={t('slots.locationPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slots-address">{t('slots.addressLabel')}</Label>
                    <Input
                      id="slots-address"
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder={t('slots.addressPlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('slots.categoryLabel')}</Label>
                      <Select
                        value={formData.category || '__none__'}
                        onValueChange={(v) =>
                          updateField('category', v === '__none__' ? '' : String(v))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('slots.categoryPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('slots.categoryNone')}</SelectItem>
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('slots.capacityLabel')}</Label>
                      <Select
                        value={String(formData.capacity)}
                        onValueChange={(v) => updateField('capacity', parseInt(v, 10))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAPACITY_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {getFieldError('capacity') && (
                        <p className="text-sm text-destructive">
                          {getFieldError('capacity')?.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slots-description">{t('slots.descriptionLabel')}</Label>
                    <Textarea
                      id="slots-description"
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder={t('slots.descriptionPlaceholder')}
                      className="min-h-[120px] resize-y"
                      rows={4}
                    />
                  </div>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={SLOT_FORM_CARD_CLASS}>
              <div className="space-y-2 p-6">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t('slots.properties')}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-border p-4',
                    isSlotTimePast(formData.slot_time) && 'opacity-55 text-muted-foreground',
                  )}
                  title={
                    isSlotTimePast(formData.slot_time) ? t('slots.visibleDisabledPast') : undefined
                  }
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{t('slots.visibleLabel')}</div>
                    <p className="text-[11px] text-muted-foreground">{t('slots.visibleHelp')}</p>
                  </div>
                  <Switch
                    checked={formData.visible}
                    onCheckedChange={(checked) => updateField('visible', checked)}
                    disabled={isSlotTimePast(formData.slot_time)}
                    className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{t('slots.notificationsLabel')}</div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('slots.notificationsHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications_enabled}
                    onCheckedChange={(checked) => updateField('notifications_enabled', checked)}
                    className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
                  />
                </div>
              </div>
            </Card>

            <Card padding="none" className={SLOT_FORM_CARD_CLASS}>
              <div className="space-y-2 p-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">
                      {t('common.contacts')}
                    </span>
                  </div>
                  <Popover
                    open={showContactSuggestions && addableContactsForForm.length > 0}
                    onOpenChange={setShowContactSuggestions}
                  >
                    <PopoverAnchor asChild>
                      <div className="relative w-full min-w-0 sm:max-w-[260px] sm:shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={contactSearch}
                          onChange={(event) => {
                            setContactSearch(event.target.value);
                            setShowContactSuggestions(true);
                          }}
                          onFocus={() => setShowContactSuggestions(true)}
                          placeholder={
                            addableContactsForForm.length === 0
                              ? t('slots.noMoreToAdd')
                              : t('common.addContact')
                          }
                          className="h-9 bg-background pl-9 text-xs"
                          disabled={addableContactsForForm.length === 0}
                        />
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={6}
                      className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                    >
                      {filteredContactSuggestions.length > 0 ? (
                        filteredContactSuggestions.map((contact) => {
                          const contactName = contact.companyName ?? `Contact ${contact.id}`;
                          const contactMeta = [
                            (contact as { email?: string }).email,
                            (contact as { phone?: string }).phone,
                          ]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                              onClick={() => {
                                setSelectedContactIds((prev) => [...prev, String(contact.id)]);
                                setContactSearch('');
                                setShowContactSuggestions(false);
                                markDirty();
                                clearValidationErrors();
                              }}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium">
                                  {contactName}
                                </span>
                                {contactMeta ? (
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {contactMeta}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                          {contactSearch.trim() ? t('common.noResults') : t('common.addContact')}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedContactIds.length > 0 && (
                  <div className="space-y-2 pt-0.5">
                    {selectedContactIds.map((id) => {
                      const contact = assignableContacts.find(
                        (c: { id: number | string }) => String(c.id) === id,
                      ) as
                        | {
                            id: number | string;
                            companyName?: string;
                            email?: string;
                            phone?: string;
                            phone2?: string;
                          }
                        | undefined;
                      const name = contact?.companyName ?? id;
                      const meta = [contact?.email, contact?.phone, contact?.phone2].filter(
                        Boolean,
                      );
                      return (
                        <div key={id} className="rounded-lg border border-border p-4">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm font-medium">{name}</span>
                              </div>
                              {meta.length > 0 && (
                                <div className="min-w-0 truncate text-xs text-muted-foreground">
                                  {meta.join(' · ')}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                                onClick={() => {
                                  setSelectedContactIds((prev) => prev.filter((x) => x !== id));
                                  markDirty();
                                  clearValidationErrors();
                                }}
                                aria-label={`${t('common.removeContact')} ${name}`}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentSlot ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
        onConfirm={() => {
          if (!currentSlot) {
            resetForm();
          }
          confirmDiscard();
        }}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
