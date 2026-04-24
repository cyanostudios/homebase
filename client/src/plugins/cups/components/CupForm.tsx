import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { filesApi } from '@/plugins/files/api/filesApi';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

type Props = {
  currentCup?: Cup | null;
  currentItem?: Cup | null;
  onSave: (data: Partial<Cup> & { name: string }) => Promise<boolean>;
  onCancel: () => void;
};

export const CupForm = React.forwardRef<PanelFormHandle, Props>(function CupForm(
  { currentCup, currentItem, onSave, onCancel },
  ref,
) {
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
    // datetime-local returns YYYY-MM-DDTHH:mm; backend validator requires seconds.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
      return `${v}:00`;
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
      cancel: () => attemptAction(onCancel),
    }),
    [submit, attemptAction, onCancel],
  );

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
                    onFieldChange('name', e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>Organizer</Label>
                <Input
                  value={form.organizer}
                  onChange={(e) => {
                    onFieldChange('organizer', e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => {
                    onFieldChange('location', e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => {
                    onFieldChange('start_date', e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => {
                    onFieldChange('end_date', e.target.value);
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Categories</Label>
                <Input
                  value={form.categories}
                  onChange={(e) => {
                    onFieldChange('categories', e.target.value);
                  }}
                  placeholder="comma separated"
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
                />
              </div>
              <div>
                <Label>Registration URL</Label>
                <Input
                  value={form.registration_url}
                  onChange={(e) => {
                    onFieldChange('registration_url', e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>Source URL</Label>
                <Input
                  value={form.source_url}
                  onChange={(e) => {
                    onFieldChange('source_url', e.target.value);
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => {
                    onFieldChange('description', e.target.value);
                  }}
                  rows={6}
                />
              </div>
              <div className="md:col-span-2">
                <div className="space-y-2 rounded-md border border-border px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Visible on public site</Label>
                      <p className="text-xs text-muted-foreground">
                        Controls whether the cup appears in Cupappen.
                      </p>
                    </div>
                    <Switch
                      checked={form.visible}
                      onCheckedChange={(checked) => {
                        onFieldChange('visible', checked);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Sanctioned cup</Label>
                      <p className="text-xs text-muted-foreground">
                        Indicates whether this cup is sanctioned.
                      </p>
                    </div>
                    <Switch
                      checked={form.sanctioned}
                      onCheckedChange={(checked) => {
                        onFieldChange('sanctioned', checked);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Featured</Label>
                      <p className="text-xs text-muted-foreground">
                        Highlights this cup in the top section on Cupappen.
                      </p>
                    </div>
                    <Switch
                      checked={form.featured}
                      onCheckedChange={(checked) => {
                        onFieldChange('featured', checked);
                      }}
                    />
                  </div>
                  <div className="border-t border-border pt-3 mt-1 space-y-2">
                    <div>
                      <Label>Hero image (Cupappen featured cards)</Label>
                      <p className="text-xs text-muted-foreground">
                        Upload a cover image for the featured card. If empty, a default photo is
                        used on the public site.
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
                      className="cursor-pointer"
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
                    {imageUploadBusy ? (
                      <p className="text-xs text-muted-foreground">Uploading…</p>
                    ) : null}
                    {imageUploadError ? (
                      <p className="text-xs text-destructive">{imageUploadError}</p>
                    ) : null}
                  </div>
                </div>
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
