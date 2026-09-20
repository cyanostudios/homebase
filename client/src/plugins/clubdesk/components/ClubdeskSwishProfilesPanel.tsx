import { Check, Download, Plus, QrCode as QrCodeIcon, Tag, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
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
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { QUICK_CONTEXT_LINK_TILE_CLASS } from '@/core/ui/QuickContextLinkTile';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import type { ClubdeskPriceList } from '../types/priceList';
import { swishLockMaskForAmount } from '../types/siteContent';
import type { ClubdeskSwishProfile } from '../types/swishProfile';

import { ClubdeskPublicVisibleSwitch } from './ClubdeskPublicVisibleSwitch';

type ApiErr = { message?: string; errors?: Array<{ field?: string; message?: string }> };

function formatApiError(err: unknown, fallback: string): string {
  const e = err as ApiErr;
  const fieldMsg = e?.errors?.[0]?.message;
  if (fieldMsg) {
    return fieldMsg;
  }
  if (typeof e?.message === 'string' && e.message) {
    return e.message;
  }
  return fallback;
}

type ClubdeskSwishProfilesPanelProps = {
  disabled?: boolean;
  publicVisible?: boolean;
  onPublicVisibleChange?: (next: boolean) => void;
};

export function ClubdeskSwishProfilesPanel({
  disabled,
  publicVisible = true,
  onPublicVisibleChange,
}: ClubdeskSwishProfilesPanelProps) {
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
          if (prev === 'new') {
            return prev;
          }
          if (prev && nextProfiles.some((p) => p.id === prev)) {
            return prev;
          }
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
      if (selectedId && selectedId !== 'new' && profile.id === selectedId) {
        continue;
      }
      for (const id of profile.priceListIds) {
        taken.add(id);
      }
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
    if (!trimmed) {
      return null;
    }
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
    if (!selectedProfile) {
      return false;
    }
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
    if (!selectedId || selectedId === 'new') {
      return;
    }
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
    if (!selectedProfile) {
      return undefined;
    }
    const label = selectedProfile.message
      ? `${selectedProfile.payee} — ${selectedProfile.message}`
      : selectedProfile.payee;
    return label.trim() || undefined;
  }, [selectedProfile]);

  const handleDownloadQr = useCallback(async () => {
    if (!payloadResult?.ok) {
      return;
    }
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
  const isNew = selectedId === 'new';

  return (
    <DetailSection
      title={t('clubdesk.siteContent.cards.swish')}
      icon={QrCodeIcon}
      iconPlugin="clubdesk"
      className="pt-0"
      subtleTitle
      titleAside={
        onPublicVisibleChange ? (
          <ClubdeskPublicVisibleSwitch
            id="clubdesk-swish-visible"
            checked={publicVisible}
            onCheckedChange={onPublicVisibleChange}
            disabled={busy}
          />
        ) : null
      }
      action={
        <RoundIconLabelButton
          type="button"
          icon={Plus}
          label={t('clubdesk.siteContent.swish.newProfile')}
          variant="soft"
          size="xs"
          alwaysExpanded
          disabled={busy || isNew}
          onClick={() => setSelectedId('new')}
        />
      }
    >
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
            {t('clubdesk.siteContent.swish.selectProfile')}
          </Label>
          <ul className="space-y-2">
            {isLoading ? (
              <li className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</li>
            ) : profiles.length === 0 && !isNew ? (
              <li className={DETAIL_EMPTY_STATE_CLASS}>
                {t('clubdesk.siteContent.swish.qrEmpty')}
              </li>
            ) : (
              <>
                {isNew ? (
                  <li
                    className={cn(
                      QUICK_CONTEXT_LINK_TILE_CLASS,
                      'bg-primary/10 ring-1 ring-border/70',
                    )}
                  >
                    <div className={DETAIL_LIST_ITEM_TITLE_CLASS}>
                      {t('clubdesk.siteContent.swish.newProfile')}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('clubdesk.siteContent.swish.payeePlaceholder')}
                    </div>
                  </li>
                ) : null}
                {profiles.map((profile) => {
                  const isSelected = selectedId === profile.id;
                  const linkedCount = profile.priceListIds.length;
                  return (
                    <li key={profile.id}>
                      <button
                        type="button"
                        className={cn(
                          QUICK_CONTEXT_LINK_TILE_CLASS,
                          'w-full text-left',
                          isSelected && 'bg-primary/10 ring-1 ring-border/70',
                          !isSelected && 'hover:bg-muted/60',
                        )}
                        onClick={() => setSelectedId(profile.id)}
                      >
                        <div className={DETAIL_LIST_ITEM_TITLE_CLASS}>{profile.payee}</div>
                        {profile.message?.trim() ? (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {profile.message.trim()}
                          </div>
                        ) : null}
                        {linkedCount > 0 ? (
                          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            {t('clubdesk.siteContent.swish.priceLists')} · {linkedCount}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </>
            )}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="clubdesk-swish-payee">
                  {t('clubdesk.siteContent.swish.payee')}
                </Label>
                <Input
                  id="clubdesk-swish-payee"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder={t('clubdesk.siteContent.swish.payeePlaceholder')}
                  disabled={busy}
                  autoComplete="off"
                  inputMode="tel"
                  className={FORM_INPUT_CLASS}
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
                  className={FORM_INPUT_CLASS}
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
                    <SelectTrigger className={cn(FORM_INPUT_CLASS, 'w-[180px]')}>
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
                      <span key={id} className="inline-flex items-center gap-1">
                        <StatusOutlineBadge icon={Tag} className={QC_STATUS_BADGE_COLORS.neutral}>
                          {listTitleById.get(id) ?? id}
                        </StatusOutlineBadge>
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          disabled={busy}
                          onClick={() => setPriceListIds((prev) => prev.filter((x) => x !== id))}
                          aria-label={t('clubdesk.siteContent.swish.removePriceList', {
                            name: listTitleById.get(id) ?? id,
                          })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={cn('mt-1 block', DETAIL_EMPTY_STATE_CLASS)}>
                    {t('clubdesk.siteContent.swish.noLinkedLists')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <RoundIconLabelButton
                  type="button"
                  icon={Check}
                  label={
                    isSaving
                      ? t('clubdesk.siteContent.swish.saving')
                      : t('clubdesk.siteContent.swish.saveProfile')
                  }
                  variant="success"
                  size="xs"
                  alwaysExpanded
                  onClick={() => void handleSave()}
                  disabled={busy || !isDirty || !payee.trim()}
                />
                {selectedId && selectedId !== 'new' ? (
                  <RoundIconLabelButton
                    type="button"
                    icon={Trash2}
                    label={t('clubdesk.siteContent.swish.deleteProfile')}
                    variant="dangerSoft"
                    size="xs"
                    alwaysExpanded
                    disabled={busy}
                    onClick={() => setShowDeleteConfirm(true)}
                  />
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                QUICK_CONTEXT_LINK_TILE_CLASS,
                'flex flex-col items-center gap-3 self-start',
              )}
            >
              {payloadResult?.ok ? (
                <>
                  <QrCode
                    value={payloadResult.value}
                    size={200}
                    alt={t('clubdesk.siteContent.swish.qrAlt')}
                    className="rounded-xl bg-white p-2 shadow-sm dark:bg-slate-950"
                  />
                  <RoundIconLabelButton
                    type="button"
                    icon={Download}
                    label={
                      isDownloading
                        ? t('clubdesk.siteContent.swish.downloading')
                        : t('clubdesk.siteContent.swish.download')
                    }
                    variant="secondary"
                    size="xs"
                    alwaysExpanded
                    onClick={() => void handleDownloadQr()}
                    disabled={isDownloading || busy}
                  />
                </>
              ) : (
                <div className="flex h-[200px] w-[200px] items-center justify-center px-3 text-center">
                  <p className={DETAIL_EMPTY_STATE_CLASS}>
                    {payloadResult && !payloadResult.ok
                      ? payloadResult.error
                      : t('clubdesk.siteContent.swish.qrEmpty')}
                  </p>
                </div>
              )}
            </div>
          </div>
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
    </DetailSection>
  );
}
