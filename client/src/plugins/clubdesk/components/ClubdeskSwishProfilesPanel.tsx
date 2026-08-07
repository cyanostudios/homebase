import { Download, Plus, Tag, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildSwishTypeCPayload,
  generateQrDataUrl,
  QrCode,
  SWISH_MESSAGE_MAX_LENGTH,
} from '@/core/qr';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import type { ClubdeskPriceList } from '../types/priceList';
import { swishLockMaskForAmount } from '../types/siteContent';
import type { ClubdeskSwishProfile } from '../types/swishProfile';

type ApiErr = { message?: string; errors?: Array<{ field?: string; message?: string }> };

function formatApiError(err: unknown, fallback: string): string {
  const e = err as ApiErr;
  const fieldMsg = e?.errors?.[0]?.message;
  if (fieldMsg) return fieldMsg;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return fallback;
}

export function ClubdeskSwishProfilesPanel({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ClubdeskSwishProfile[]>([]);
  const [priceLists, setPriceLists] = useState<ClubdeskPriceList[]>([]);
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [payee, setPayee] = useState('');
  const [message, setMessage] = useState('');
  const [priceListIds, setPriceListIds] = useState<string[]>([]);
  const [listToAdd, setListToAdd] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nextProfiles, nextLists] = await Promise.all([
        clubdeskApi.getSwishProfiles(),
        clubdeskApi.getPriceLists(),
      ]);
      setProfiles(nextProfiles);
      setPriceLists(nextLists);
      if (nextProfiles.length > 0) {
        setSelectedId((prev) => {
          if (prev === 'new') return prev;
          if (prev && nextProfiles.some((p) => p.id === prev)) return prev;
          return nextProfiles[0].id;
        });
      } else {
        setSelectedId('new');
      }
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.siteContent.swish.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProfile = useMemo(
    () => (selectedId && selectedId !== 'new' ? profiles.find((p) => p.id === selectedId) : null),
    [profiles, selectedId],
  );

  useEffect(() => {
    if (selectedId === 'new') {
      setPayee('');
      setMessage('');
      setPriceListIds([]);
      return;
    }
    if (selectedProfile) {
      setPayee(selectedProfile.payee);
      setMessage(selectedProfile.message);
      setPriceListIds([...selectedProfile.priceListIds]);
    }
  }, [selectedId, selectedProfile]);

  const takenByOther = useMemo(() => {
    const taken = new Set<string>();
    for (const profile of profiles) {
      if (selectedId && selectedId !== 'new' && profile.id === selectedId) continue;
      for (const id of profile.priceListIds) taken.add(id);
    }
    return taken;
  }, [profiles, selectedId]);

  const addableLists = useMemo(
    () =>
      priceLists.filter((list) => !priceListIds.includes(list.id) && !takenByOther.has(list.id)),
    [priceLists, priceListIds, takenByOther],
  );

  const listTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of priceLists) {
      map.set(list.id, list.title || list.slug || list.id);
    }
    return map;
  }, [priceLists]);

  const payloadResult = useMemo(() => {
    const trimmed = payee.trim();
    if (!trimmed) return null;
    return buildSwishTypeCPayload({
      payee: trimmed,
      amount: null,
      message: message.trim() || null,
      lockMask: swishLockMaskForAmount(null),
    });
  }, [message, payee]);

  const isDirty = useMemo(() => {
    if (selectedId === 'new') {
      return Boolean(payee.trim() || message.trim() || priceListIds.length > 0);
    }
    if (!selectedProfile) return false;
    const idsEqual =
      priceListIds.length === selectedProfile.priceListIds.length &&
      priceListIds.every((id) => selectedProfile.priceListIds.includes(id));
    return (
      payee.trim() !== selectedProfile.payee ||
      message.trim() !== selectedProfile.message ||
      !idsEqual
    );
  }, [message, payee, priceListIds, selectedId, selectedProfile]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const check = buildSwishTypeCPayload({
        payee: payee.trim(),
        amount: null,
        message: message.trim() || null,
        lockMask: swishLockMaskForAmount(null),
      });
      if (!check.ok) {
        setErrorMessage(check.error);
        return;
      }
      const payload = {
        payee: payee.trim(),
        message: message.trim().slice(0, SWISH_MESSAGE_MAX_LENGTH),
        priceListIds,
      };
      const saved =
        selectedId === 'new'
          ? await clubdeskApi.createSwishProfile(payload)
          : await clubdeskApi.updateSwishProfile(selectedId!, payload);
      setProfiles((prev) => {
        const without = prev.filter((p) => p.id !== saved.id);
        return [...without, saved].sort(
          (a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id),
        );
      });
      setSelectedId(saved.id);
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.siteContent.swish.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  }, [message, payee, priceListIds, selectedId, t]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedId || selectedId === 'new') return;
    setShowDeleteConfirm(false);
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await clubdeskApi.deleteSwishProfile(selectedId);
      const next = profiles.filter((p) => p.id !== selectedId);
      setProfiles(next);
      setSelectedId(next[0]?.id ?? 'new');
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.siteContent.swish.deleteFailed')));
    } finally {
      setIsSaving(false);
    }
  }, [profiles, selectedId, t]);

  const deleteDisplayName = useMemo(() => {
    if (!selectedProfile) return undefined;
    const label = selectedProfile.message
      ? `${selectedProfile.payee} — ${selectedProfile.message}`
      : selectedProfile.payee;
    return label.trim() || undefined;
  }, [selectedProfile]);

  const handleDownloadQr = useCallback(async () => {
    if (!payloadResult?.ok) return;
    setIsDownloading(true);
    try {
      const dataUrl = await generateQrDataUrl(payloadResult.value, { width: 512 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'swish-qr.png';
      link.click();
    } catch {
      setErrorMessage(t('clubdesk.siteContent.swish.downloadFailed'));
    } finally {
      setIsDownloading(false);
    }
  }, [payloadResult, t]);

  const busy = disabled || isLoading || isSaving;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('clubdesk.siteContent.cards.swishHelp')}</p>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedId ?? undefined}
          onValueChange={(value) => setSelectedId(value as string | 'new')}
          disabled={busy}
        >
          <SelectTrigger className="h-9 w-[min(100%,280px)] text-xs">
            <SelectValue placeholder={t('clubdesk.siteContent.swish.selectProfile')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t('clubdesk.siteContent.swish.newProfile')}</SelectItem>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.payee}
                {profile.message ? ` — ${profile.message}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Plus}
          disabled={busy || selectedId === 'new'}
          onClick={() => setSelectedId('new')}
        >
          {t('clubdesk.siteContent.swish.newProfile')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clubdesk-swish-payee">{t('clubdesk.siteContent.swish.payee')}</Label>
            <Input
              id="clubdesk-swish-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder={t('clubdesk.siteContent.swish.payeePlaceholder')}
              disabled={busy}
              autoComplete="off"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clubdesk-swish-message">
              {t('clubdesk.siteContent.swish.message')}
            </Label>
            <Input
              id="clubdesk-swish-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, SWISH_MESSAGE_MAX_LENGTH))}
              placeholder={t('clubdesk.siteContent.swish.messagePlaceholder')}
              disabled={busy}
              maxLength={SWISH_MESSAGE_MAX_LENGTH}
            />
            <p className="text-xs text-muted-foreground">
              {t('clubdesk.siteContent.swish.messageHint', { max: SWISH_MESSAGE_MAX_LENGTH })}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label>{t('clubdesk.siteContent.swish.priceLists')}</Label>
              <Select
                value={listToAdd || '__add__'}
                onValueChange={(value) => {
                  if (value && value !== '__add__') {
                    setPriceListIds((prev) => (prev.includes(value) ? prev : [...prev, value]));
                    setListToAdd('');
                  }
                }}
                disabled={busy || addableLists.length === 0}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder={t('clubdesk.siteContent.swish.addPriceList')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add__">
                    {addableLists.length === 0
                      ? t('clubdesk.siteContent.swish.noPriceLists')
                      : t('clubdesk.siteContent.swish.addPriceList')}
                  </SelectItem>
                  {addableLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.title || list.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('clubdesk.siteContent.swish.priceListsHint')}
            </p>
            {priceListIds.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {priceListIds.map((id) => (
                  <Badge
                    key={id}
                    className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Tag className="h-3 w-3" />
                    {listTitleById.get(id) ?? id}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      disabled={busy}
                      onClick={() => setPriceListIds((prev) => prev.filter((x) => x !== id))}
                      aria-label={t('clubdesk.siteContent.swish.removePriceList', {
                        name: listTitleById.get(id) ?? id,
                      })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('clubdesk.siteContent.swish.noLinkedLists')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={busy || !isDirty || !payee.trim()}
            >
              {isSaving
                ? t('clubdesk.siteContent.swish.saving')
                : t('clubdesk.siteContent.swish.saveProfile')}
            </Button>
            {selectedId && selectedId !== 'new' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Trash2}
                className="text-destructive"
                disabled={busy}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t('clubdesk.siteContent.swish.deleteProfile')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3">
          {payloadResult?.ok ? (
            <>
              <QrCode
                value={payloadResult.value}
                size={200}
                alt={t('clubdesk.siteContent.swish.qrAlt')}
                className={cn('rounded-md border border-border bg-white p-2')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => void handleDownloadQr()}
                disabled={isDownloading || busy}
              >
                {isDownloading
                  ? t('clubdesk.siteContent.swish.downloading')
                  : t('clubdesk.siteContent.swish.download')}
              </Button>
            </>
          ) : (
            <div className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-center">
              <p className="text-sm text-muted-foreground">
                {payloadResult && !payloadResult.ok
                  ? payloadResult.error
                  : t('clubdesk.siteContent.swish.qrEmpty')}
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', {
          label: t('clubdesk.siteContent.cards.swish'),
        })}
        message={buildDeleteMessage(t, 'clubdesk.siteContent.swish', deleteDisplayName)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
        confirmDisabled={isSaving}
      />
    </div>
  );
}
