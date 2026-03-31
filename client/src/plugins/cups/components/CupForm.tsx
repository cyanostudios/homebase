import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

type Props = {
  currentCup?: Cup | null;
  currentItem?: Cup | null;
  onSave: (data: Partial<Cup> & { name: string }) => Promise<boolean>;
  onCancel: () => void;
};

export function CupForm({ currentCup, currentItem, onSave, onCancel }: Props) {
  const { validationErrors, clearValidationErrors } = useCups();
  const item = currentCup ?? currentItem ?? null;
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  });
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();

  useEffect(() => {
    setForm({
      name: item?.name || '',
      organizer: item?.organizer || '',
      location: item?.location || '',
      start_date: item?.start_date ? String(item.start_date).slice(0, 16) : '',
      end_date: item?.end_date ? String(item.end_date).slice(0, 16) : '',
      categories: item?.categories || '',
      team_count:
        item?.team_count !== null && item?.team_count !== undefined ? String(item.team_count) : '',
      match_format: item?.match_format || '',
      registration_url: item?.registration_url || '',
      source_url: item?.source_url || '',
      description: item?.description || '',
    });
    clearValidationErrors();
    markClean();
  }, [item, clearValidationErrors, markClean]);

  const hasErrors = useMemo(
    () => validationErrors.some((e) => !e.message.includes('Warning')),
    [validationErrors],
  );

  const submit = async () => {
    setIsSubmitting(true);
    const ok = await onSave({
      ...form,
      name: form.name.trim(),
      organizer: form.organizer || null,
      location: form.location || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      categories: form.categories || null,
      registration_url: form.registration_url || null,
      source_url: form.source_url || null,
      description: form.description || null,
    });
    setIsSubmitting(false);
    if (ok) {
      markClean();
    }
  };

  useEffect(() => {
    (window as any).submitCupForm = submit;
    (window as any).cancelCupForm = () => attemptAction(onCancel);
    return () => {
      delete (window as any).submitCupForm;
      delete (window as any).cancelCupForm;
    };
  });

  return (
    <>
      <DetailLayout>
        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection title="Cup details" className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div>
                <Label>Organizer</Label>
                <Input
                  value={form.organizer}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, organizer: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, location: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, start_date: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, end_date: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Categories</Label>
                <Input
                  value={form.categories}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, categories: e.target.value }));
                    markDirty();
                  }}
                  placeholder="comma separated"
                />
              </div>
              <div>
                <Label>Match format</Label>
                <Input
                  value={form.match_format}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, match_format: e.target.value }));
                    markDirty();
                  }}
                  placeholder="e.g. 5 vs 5"
                />
              </div>
              <div>
                <Label>Teams</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.team_count}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, team_count: e.target.value }));
                    markDirty();
                  }}
                  placeholder="team count"
                />
              </div>
              <div>
                <Label>Registration URL</Label>
                <Input
                  value={form.registration_url}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, registration_url: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div>
                <Label>Source URL</Label>
                <Input
                  value={form.source_url}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, source_url: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, description: e.target.value }));
                    markDirty();
                  }}
                  rows={6}
                />
              </div>
            </div>
          </DetailSection>
        </Card>
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
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => attemptAction(onCancel)}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={isSubmitting || hasErrors}
          className="bg-green-600 hover:bg-green-700 text-white border-none"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
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
}
