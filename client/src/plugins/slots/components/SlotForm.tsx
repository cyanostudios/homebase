import { X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { MatchDateTimePicker } from '@/plugins/matches/components/MatchDateTimePicker';

import { useSlotsContext as useSlots } from '../context/SlotsContext';
import { CAPACITY_OPTIONS, type SlotMention } from '../types/slots';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { SlotsSettingsForm } from './SlotsSettingsForm';

interface SlotFormState {
  location: string;
  slot_time: string;
  capacity: number;
  visible: boolean;
  notifications_enabled: boolean;
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
    slot_time: string;
    location: string | null;
    capacity: number;
    visible: boolean;
    notifications_enabled: boolean;
    contact_id?: string | null;
    mentions?: SlotMention[];
  } | null;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  onSaveSlots?: (dataArray: Record<string, unknown>[]) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function SlotForm({
  currentSlot,
  onSave,
  onSaveSlots,
  onCancel,
  isSubmitting: _isSubmitting = false,
}: SlotFormProps) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const { validationErrors, clearValidationErrors, panelMode } = useSlots();
  const assignableContacts = contacts.filter(
    (c: { isAssignable?: boolean }) => c.isAssignable !== false,
  );
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [formData, setFormData] = useState<SlotFormState>({
    location: '',
    slot_time: '',
    capacity: 1,
    visible: true,
    notifications_enabled: true,
  });
  /** Selected contact IDs for this slot (multiple contacts). */
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  /** Series mode: generate multiple slots from start time + duration + gap */
  const [isSeries, setIsSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [gapMinutes, setGapMinutes] = useState(30);

  useEffect(() => {
    const formKey = `slot-form-${currentSlot?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentSlot, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      location: '',
      slot_time: '',
      capacity: 1,
      visible: true,
      notifications_enabled: true,
    });
    setSelectedContactIds([]);
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

  useEffect(() => {
    if (currentSlot) {
      setFormData({
        location: currentSlot.location ?? '',
        slot_time: toDatetimeLocal(currentSlot.slot_time),
        capacity: currentSlot.capacity,
        visible: currentSlot.visible,
        notifications_enabled: currentSlot.notifications_enabled,
      });
      const fromMentions =
        currentSlot.mentions?.map((m) => String(m.contactId)).filter(Boolean) ?? [];
      const fromContactId =
        currentSlot.contact_id && !fromMentions.includes(String(currentSlot.contact_id))
          ? [String(currentSlot.contact_id)]
          : [];
      setSelectedContactIds(fromMentions.length > 0 ? fromMentions : fromContactId);
      markClean();
    } else if (panelMode !== 'settings') {
      resetForm();
    }
  }, [currentSlot, panelMode, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (panelMode === 'settings') {
      onCancel();
      return;
    }
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
        location: formData.location,
        slot_time: date.toISOString(),
        capacity: formData.capacity,
        visible: formData.visible,
        notifications_enabled: formData.notifications_enabled,
        contact_id: selectedContactIds[0] ?? null,
        mentions,
      }));
      const ok = await onSaveSlots(payloads);
      if (ok) {
        markClean();
        resetForm();
      }
      return;
    }

    const payload = {
      ...formData,
      slot_time: formData.slot_time ? new Date(formData.slot_time).toISOString() : '',
      contact_id: selectedContactIds[0] ?? null,
      mentions,
    };
    const ok = await onSave(payload);
    if (ok) {
      markClean();
      if (!currentSlot) {
        resetForm();
      }
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
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  const submitRef = useRef(handleSubmit);
  const cancelRef = useRef(handleCancel);
  submitRef.current = handleSubmit;
  cancelRef.current = handleCancel;
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (panelMode === 'settings') {
      return;
    }
    (window as unknown as { submitSlotsForm?: () => void }).submitSlotsForm = () =>
      submitRef.current?.();
    (window as unknown as { cancelSlotsForm?: () => void }).cancelSlotsForm = () =>
      cancelRef.current?.();
    return () => {
      delete (window as unknown as { submitSlotsForm?: () => void }).submitSlotsForm;
      delete (window as unknown as { cancelSlotsForm?: () => void }).cancelSlotsForm;
    };
  }, [panelMode]);

  if (panelMode === 'settings') {
    return <SlotsSettingsForm onCancel={onCancel} />;
  }

  const updateField = <K extends keyof SlotFormState>(field: K, value: SlotFormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some(
    (e) => !e.message?.toLowerCase().includes('warning'),
  );

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
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
              <p className="text-[11px] text-muted-foreground">{t('slots.generateSeriesHelp')}</p>
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

        <DetailSection title={t('slots.sectionTitle')} iconPlugin="slots" className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="slots-time">{t('slots.timeLabel')}</Label>
                <MatchDateTimePicker
                  value={formData.slot_time}
                  onChange={(v) => updateField('slot_time', v)}
                  hasError={Boolean(getFieldError('slot_time'))}
                />
                {getFieldError('slot_time') && (
                  <p className="text-sm text-destructive">{getFieldError('slot_time')?.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('common.contacts')}</Label>
              <div className="flex gap-2">
                <Select
                  value="__add__"
                  onValueChange={(v) => {
                    if (v && v !== '__add__' && !selectedContactIds.includes(v)) {
                      setSelectedContactIds((prev) => [...prev, v]);
                      markDirty();
                      clearValidationErrors();
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('common.addContact')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add__" className="text-muted-foreground">
                      {t('common.addContact')}
                    </SelectItem>
                    {assignableContacts
                      .filter(
                        (c: { id: number | string }) => !selectedContactIds.includes(String(c.id)),
                      )
                      .map((contact: { id: number | string; companyName?: string }) => (
                        <SelectItem key={contact.id} value={String(contact.id)}>
                          {contact.companyName ?? `Contact ${contact.id}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedContactIds.length > 0 && (
                <ul className="flex flex-wrap gap-2 mt-2">
                  {selectedContactIds.map((id) => {
                    const contact = assignableContacts.find(
                      (c: { id: number | string }) => String(c.id) === id,
                    );
                    const name =
                      (contact as { companyName?: string } | undefined)?.companyName ?? id;
                    return (
                      <li
                        key={id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContactIds((prev) => prev.filter((x) => x !== id));
                            markDirty();
                            clearValidationErrors();
                          }}
                          className="rounded hover:bg-muted-foreground/20 p-0.5"
                          aria-label={`${t('common.removeContact')} ${name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                <p className="text-sm text-destructive">{getFieldError('capacity')?.message}</p>
              )}
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
                <Label className="text-sm font-medium">{t('slots.visibleLabel')}</Label>
                <p className="text-[11px] text-muted-foreground">{t('slots.visibleHelp')}</p>
              </div>
              <Switch
                checked={formData.visible}
                onCheckedChange={(checked) => updateField('visible', checked)}
                disabled={isSlotTimePast(formData.slot_time)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('slots.notificationsLabel')}</Label>
                <p className="text-[11px] text-muted-foreground">{t('slots.notificationsHelp')}</p>
              </div>
              <Switch
                checked={formData.notifications_enabled}
                onCheckedChange={(checked) => updateField('notifications_enabled', checked)}
              />
            </div>
          </div>
        </DetailSection>
      </form>

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
    </div>
  );
}
