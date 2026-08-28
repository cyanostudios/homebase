import {
  Calendar as CalendarIcon,
  Play,
  RotateCcw,
  Search,
  Square,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { Text } from '@/core/ui/Typography';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { useOptionalTimeTrackingActivityDispatch } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';

function contactLabel(contact: Contact): string {
  return contact.companyName?.trim() || contact.email?.trim() || `Contact ${contact.id}`;
}

export function TimerPanel() {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const setActiveTrackingContactId = useOptionalTimeTrackingActivityDispatch();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDate, setManualDate] = useState<Date>(() => new Date());
  const [manualDateOpen, setManualDateOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((c) => String(c.id) === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const filteredSuggestions = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const list = contacts as Contact[];
    if (!q) {
      return list.slice(0, 40);
    }
    return list
      .filter((c) => {
        const name = (c.companyName ?? '').toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        const phone = (c.phone ?? '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 40);
  }, [contacts, contactSearch]);

  const openPopover = showSuggestions && contacts.length > 0 && !selectedContactId;

  useEffect(() => {
    const id = selectedContactId.trim();
    if (isRunning && id) {
      setActiveTrackingContactId(id);
    } else {
      setActiveTrackingContactId(null);
    }
  }, [isRunning, selectedContactId, setActiveTrackingContactId]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContactId(String(contact.id));
    setContactSearch('');
    setShowSuggestions(false);
  };

  const handleClearContact = () => {
    setSelectedContactId('');
    setContactSearch('');
  };

  const handleAddToContact = async () => {
    if (!selectedContactId) {
      return;
    }
    const minutes = parseInt(manualMinutes, 10);
    if (useManualEntry && (Number.isNaN(minutes) || minutes <= 0)) {
      return;
    }
    if (!useManualEntry && elapsedSeconds <= 0) {
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      const seconds = useManualEntry ? minutes * 60 : elapsedSeconds;
      const loggedAt = useManualEntry ? manualDate.toISOString() : new Date().toISOString();
      const res = await apiFetch(`/api/contacts/${selectedContactId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds, loggedAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add time');
      }
      window.dispatchEvent(
        new CustomEvent('homebase:contact-time-entry-added', {
          detail: { contactId: selectedContactId },
        }),
      );
      if (!useManualEntry) {
        setElapsedSeconds(0);
      } else {
        setManualMinutes('');
        setManualDate(new Date());
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add time');
    } finally {
      setAdding(false);
    }
  };

  const canAdd =
    selectedContactId &&
    (useManualEntry
      ? manualMinutes.trim() !== '' && parseInt(manualMinutes, 10) > 0
      : elapsedSeconds > 0);

  return (
    <div className="space-y-4">
      <div className="text-center text-4xl font-bold tabular-nums text-foreground">
        {formatTime(elapsedSeconds)}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {!isRunning ? (
          <RoundIconLabelButton
            icon={Play}
            label="Start"
            variant="primary"
            size="xs"
            alwaysExpanded
            onClick={() => setIsRunning(true)}
          />
        ) : (
          <RoundIconLabelButton
            icon={Square}
            label="Stop"
            variant="soft"
            size="xs"
            alwaysExpanded
            onClick={() => setIsRunning(false)}
          />
        )}
        <RoundIconLabelButton
          icon={RotateCcw}
          label="Reset"
          variant="secondary"
          size="xs"
          alwaysExpanded
          onClick={() => {
            setIsRunning(false);
            setElapsedSeconds(0);
          }}
        />
      </div>

      <div className="space-y-3 pt-6">
        <div className="flex items-center justify-between gap-3">
          <Text className="text-sm font-medium">Add time manually</Text>
          <Switch checked={useManualEntry} onCheckedChange={setUseManualEntry} />
        </div>
        {useManualEntry ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sr-only">Minutes</label>
              <input
                type="number"
                min={1}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                placeholder="Min"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <Popover open={manualDateOpen} onOpenChange={setManualDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={CalendarIcon}
                  className="w-full"
                >
                  {manualDate.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[120] w-auto p-2" align="end">
                <DayPicker
                  mode="single"
                  selected={manualDate}
                  onSelect={(d) => {
                    if (d) {
                      setManualDate(d);
                      setManualDateOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        {selectedContact ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{contactLabel(selectedContact)}</p>
              {selectedContact.email ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {selectedContact.email}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={X}
              className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
              aria-label={t('common.clear', { defaultValue: 'Clear' })}
              onClick={handleClearContact}
            />
          </div>
        ) : (
          <Popover open={openPopover} onOpenChange={setShowSuggestions}>
            <PopoverAnchor asChild>
              <div className="relative w-full min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  {...LIST_SEARCH_FIELD_PROPS}
                  name="homebase-contact-search"
                  value={contactSearch}
                  onChange={(event) => {
                    setContactSearch(event.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={
                    contacts.length === 0
                      ? t('common.noContacts', { defaultValue: 'No contacts' })
                      : t('tasks.addAssigneePlaceholder')
                  }
                  className="h-9 bg-background pl-9 text-xs"
                  disabled={contacts.length === 0}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
            >
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((contact) => {
                  const name = contactLabel(contact);
                  const meta = [contact.email, contact.phone].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                      onClick={() => handleSelectContact(contact)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{name}</span>
                        {meta ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  {contactSearch.trim() ? t('common.noResults') : t('tasks.addAssigneePlaceholder')}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        <RoundIconLabelButton
          icon={UserPlus}
          label={adding ? 'Adding…' : 'Add time to contact'}
          variant="soft"
          size="xs"
          alwaysExpanded
          disabled={!canAdd || adding}
          onClick={() => void handleAddToContact()}
        />
        {addError ? (
          <Text variant="muted" className="text-xs text-destructive">
            {addError}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
