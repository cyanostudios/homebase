import React, { useCallback, useEffect, useRef, useState } from 'react';

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
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { MatchDateTimePicker } from '@/plugins/matches/components/MatchDateTimePicker';

import { useKiosk } from '../hooks/useKiosk';
import { CAPACITY_OPTIONS } from '../types/kiosk';

import { KioskSettingsForm } from './KioskSettingsForm';

interface KioskFormState {
  location: string;
  slot_time: string;
  capacity: number;
  visible: boolean;
  notifications_enabled: boolean;
}

interface KioskFormProps {
  currentSlot?: {
    id: string;
    slot_time: string;
    location: string | null;
    capacity: number;
    visible: boolean;
    notifications_enabled: boolean;
  } | null;
  onSave: (data: KioskFormState) => Promise<boolean>;
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

export function KioskForm({
  currentSlot,
  onSave,
  onCancel,
  isSubmitting: _isSubmitting = false,
}: KioskFormProps) {
  const { validationErrors, clearValidationErrors, panelMode } = useKiosk();
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

  const [formData, setFormData] = useState<KioskFormState>({
    location: '',
    slot_time: '',
    capacity: 1,
    visible: true,
    notifications_enabled: true,
  });

  useEffect(() => {
    const formKey = `kiosk-form-${currentSlot?.id || 'new'}`;
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
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentSlot) {
      setFormData({
        location: currentSlot.location ?? '',
        slot_time: toDatetimeLocal(currentSlot.slot_time),
        capacity: currentSlot.capacity,
        visible: currentSlot.visible,
        notifications_enabled: currentSlot.notifications_enabled,
      });
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
    const payload = {
      ...formData,
      slot_time: formData.slot_time ? new Date(formData.slot_time).toISOString() : '',
    };
    const ok = await onSave(payload);
    if (ok) {
      markClean();
      if (!currentSlot) {
        resetForm();
      }
    }
  }, [panelMode, formData, onSave, onCancel, markClean, currentSlot, resetForm]);

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
    (window as unknown as { submitKioskForm?: () => void }).submitKioskForm = () =>
      submitRef.current?.();
    (window as unknown as { cancelKioskForm?: () => void }).cancelKioskForm = () =>
      cancelRef.current?.();
    return () => {
      delete (window as unknown as { submitKioskForm?: () => void }).submitKioskForm;
      delete (window as unknown as { cancelKioskForm?: () => void }).cancelKioskForm;
    };
  }, [panelMode]);

  if (panelMode === 'settings') {
    return <KioskSettingsForm onCancel={onCancel} />;
  }

  const updateField = <K extends keyof KioskFormState>(field: K, value: KioskFormState[K]) => {
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
            <div className="text-sm text-destructive font-medium">Cannot save</div>
            <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
              {validationErrors
                .filter((e) => !e.message?.toLowerCase().includes('warning'))
                .map((e) => (
                  <li key={`${e.field}-${e.message}`}>{e.message}</li>
                ))}
            </ul>
          </Card>
        )}

        <DetailSection title="Slot" iconPlugin="kiosk" className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kiosk-location">Plats (Location)</Label>
                <Input
                  id="kiosk-location"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="e.g. Main entrance"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-time">Tid (Time)</Label>
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
              <Label>Capacity (1–5)</Label>
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
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Visible</Label>
                <p className="text-[11px] text-muted-foreground">Show this slot in the kiosk</p>
              </div>
              <Switch
                checked={formData.visible}
                onCheckedChange={(checked) => updateField('visible', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Notifications</Label>
                <p className="text-[11px] text-muted-foreground">
                  Enable notifications for this slot
                </p>
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
        title="Unsaved changes"
        message={
          currentSlot
            ? 'Discard changes and return to view?'
            : 'Discard changes and close the form?'
        }
        confirmText="Discard"
        cancelText="Continue editing"
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
