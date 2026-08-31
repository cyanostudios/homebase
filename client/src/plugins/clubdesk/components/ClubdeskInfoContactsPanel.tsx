import { ArrowDown, ArrowUp, Plus, Search, Trash2, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { contactsApi } from '@/plugins/contacts/api/contactsApi';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import type { ClubdeskInfoContact } from '../types/infoContact';

type ApiErr = { message?: string; errors?: Array<{ field?: string; message?: string }> };

function formatApiError(err: unknown, fallback: string): string {
  const e = err as ApiErr;
  const fieldMsg = e?.errors?.[0]?.message;
  if (fieldMsg) return fieldMsg;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return fallback;
}

function contactLabel(c: Pick<Contact, 'id' | 'companyName' | 'email' | 'phone'>): string {
  return (c.companyName || '').trim() || `Kontakt ${c.id}`;
}

export function ClubdeskInfoContactsPanel({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ClubdeskInfoContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [contactId, setContactId] = useState('');
  const [blurb, setBlurb] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nextRows, nextContacts] = await Promise.all([
        clubdeskApi.getInfoContacts(),
        contactsApi.getContacts() as Promise<Contact[]>,
      ]);
      setRows(nextRows);
      setContacts(Array.isArray(nextContacts) ? nextContacts : []);
      if (nextRows.length > 0) {
        setSelectedId((prev) => {
          if (prev === 'new') return prev;
          if (prev && nextRows.some((r) => r.id === prev)) return prev;
          return nextRows[0].id;
        });
      } else {
        setSelectedId('new');
      }
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.infoContacts.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (selectedId && selectedId !== 'new' ? rows.find((r) => r.id === selectedId) : null),
    [rows, selectedId],
  );

  useEffect(() => {
    if (selectedId === 'new') {
      setContactId('');
      setBlurb('');
      setContactSearch('');
      return;
    }
    if (selected) {
      setContactId(selected.contactId);
      setBlurb(selected.blurb);
      setContactSearch(selected.contact.displayName);
    }
  }, [selectedId, selected]);

  const usedContactIds = useMemo(() => {
    const taken = new Set<string>();
    for (const row of rows) {
      if (selectedId && selectedId !== 'new' && row.id === selectedId) continue;
      taken.add(row.contactId);
    }
    return taken;
  }, [rows, selectedId]);

  const suggestions = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return contacts
      .filter((c) => !usedContactIds.has(String(c.id)))
      .filter((c) => {
        if (!q) return true;
        const hay = [c.companyName, c.email, c.phone].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [contacts, contactSearch, usedContactIds]);

  const linkedContact = useMemo(
    () => contacts.find((c) => String(c.id) === String(contactId)) || null,
    [contacts, contactId],
  );

  const isDirty = useMemo(() => {
    if (selectedId === 'new') {
      return Boolean(contactId || blurb.trim());
    }
    if (!selected) return false;
    return contactId !== selected.contactId || blurb.trim() !== selected.blurb;
  }, [selectedId, contactId, blurb, selected]);

  const handleSave = async () => {
    if (!contactId) {
      setErrorMessage(t('clubdesk.infoContacts.contactRequired'));
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (selectedId === 'new') {
        const created = await clubdeskApi.createInfoContact({
          contactId,
          blurb: blurb.trim(),
        });
        setRows((prev) => [...prev, created]);
        setSelectedId(created.id);
      } else if (selectedId) {
        const updated = await clubdeskApi.updateInfoContact(selectedId, {
          contactId,
          blurb: blurb.trim(),
        });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.infoContacts.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || selectedId === 'new') return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await clubdeskApi.deleteInfoContact(selectedId);
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setSelectedId('new');
      setShowDeleteConfirm(false);
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.infoContacts.deleteFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const moveRow = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    const ordered = rows.map((r) => r.id);
    const tmp = ordered[index];
    ordered[index] = ordered[next];
    ordered[next] = tmp;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await clubdeskApi.reorderInfoContacts(ordered);
      setRows(updated);
    } catch (err) {
      setErrorMessage(formatApiError(err, t('clubdesk.infoContacts.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('clubdesk.infoContacts.help')}</p>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">
              {t('clubdesk.infoContacts.listTitle')}
            </Label>
            <RoundIconLabelButton
              type="button"
              icon={Plus}
              label={t('clubdesk.infoContacts.add')}
              variant="soft"
              size="xs"
              alwaysExpanded
              disabled={disabled || isLoading || isSaving}
              onClick={() => setSelectedId('new')}
            />
          </div>
          <div className="space-y-1 rounded-lg border border-border p-1">
            {isLoading ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">{t('common.loading')}</p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t('clubdesk.infoContacts.empty')}
              </p>
            ) : (
              rows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs',
                      selectedId === row.id ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="block truncate">{row.contact.displayName}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={ArrowUp}
                    className="h-7 w-7 px-0"
                    disabled={isSaving || index === 0}
                    aria-label={t('clubdesk.infoContacts.moveUp')}
                    onClick={() => void moveRow(index, -1)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={ArrowDown}
                    className="h-7 w-7 px-0"
                    disabled={isSaving || index === rows.length - 1}
                    aria-label={t('clubdesk.infoContacts.moveDown')}
                    onClick={() => void moveRow(index, 1)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label>{t('clubdesk.infoContacts.contact')}</Label>
            {linkedContact ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">
                    {contactLabel(linkedContact)}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={disabled || isSaving}
                  onClick={() => {
                    setContactId('');
                    setContactSearch('');
                  }}
                >
                  {t('common.remove')}
                </button>
              </div>
            ) : (
              <Popover
                open={showSuggestions && suggestions.length > 0}
                onOpenChange={setShowSuggestions}
              >
                <PopoverAnchor asChild>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={contactSearch}
                      onChange={(e) => {
                        setContactSearch(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder={t('clubdesk.infoContacts.searchContact')}
                      className="h-9 pl-9 text-xs"
                      disabled={disabled || isLoading || isSaving}
                    />
                  </div>
                </PopoverAnchor>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                >
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-start rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        setContactId(String(c.id));
                        setContactSearch(contactLabel(c));
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {contactLabel(c)}
                        </span>
                        {c.email ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {c.email}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clubdesk-info-contact-blurb">{t('clubdesk.infoContacts.blurb')}</Label>
            <Textarea
              id="clubdesk-info-contact-blurb"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('clubdesk.infoContacts.blurbPlaceholder')}
              disabled={disabled || isLoading || isSaving}
              className="text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || isLoading || isSaving || !isDirty || !contactId}
              onClick={() => void handleSave()}
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
            {selectedId && selectedId !== 'new' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="text-destructive"
                disabled={disabled || isSaving}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', {
          label: t('clubdesk.siteContent.cards.contacts'),
        })}
        message={buildDeleteMessage(t, 'clubdesk.infoContacts', selected?.contact.displayName)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
        confirmDisabled={isSaving}
      />
    </div>
  );
}
