import {
  Calendar as CalendarIcon,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { useTimer, type TimerSlotView } from '@/core/ui/rightSidebar/TimerContext';
import { Text } from '@/core/ui/Typography';
import { cn } from '@/lib/utils';

function TimerSlotCard({
  timer,
  index,
  total,
}: {
  timer: TimerSlotView;
  index: number;
  total: number;
}) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const {
    contactLabel,
    removeTimer,
    start,
    stop,
    reset,
    setContactSearch,
    setShowSuggestions,
    selectContact,
    clearContact,
    setUseManualEntry,
    setManualMinutes,
    setManualDate,
    setManualDateOpen,
    addToContact,
  } = useTimer();

  const canRemove = total > 1;

  return (
    <div className={cn('space-y-4', index > 0 && 'border-t border-border/60 pt-4')}>
      <div className="flex items-center justify-between gap-2">
        <Text className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {t('rightSidebar.timerN', {
            defaultValue: 'Timer {{n}}',
            n: index + 1,
          })}
        </Text>
        {canRemove ? (
          <RoundIconLabelButton
            type="button"
            icon={Trash2}
            label={t('rightSidebar.removeTimer', { defaultValue: 'Remove timer' })}
            variant="dangerSoft"
            size="xs"
            expandOnHover={false}
            onClick={() => removeTimer(timer.id)}
          />
        ) : null}
      </div>

      <div className="text-center text-4xl font-bold tabular-nums text-foreground">
        {timer.timeDisplay}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {!timer.isRunning ? (
          <RoundIconLabelButton
            icon={Play}
            label="Start"
            variant="success"
            size="xs"
            alwaysExpanded
            onClick={() => start(timer.id)}
          />
        ) : (
          <RoundIconLabelButton
            icon={Square}
            label="Stop"
            variant="success"
            size="xs"
            alwaysExpanded
            onClick={() => stop(timer.id)}
          />
        )}
        <RoundIconLabelButton
          icon={RotateCcw}
          label="Reset"
          variant="secondary"
          size="xs"
          alwaysExpanded
          className="border-none bg-amber-600 text-white hover:bg-amber-700 hover:text-white dark:bg-amber-600 dark:hover:bg-amber-700"
          onClick={() => reset(timer.id)}
        />
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Text className="text-sm font-medium">Add time manually</Text>
          <Switch
            checked={timer.useManualEntry}
            onCheckedChange={(checked) => setUseManualEntry(timer.id, checked)}
          />
        </div>
        {timer.useManualEntry ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sr-only">Minutes</label>
              <input
                type="number"
                min={1}
                value={timer.manualMinutes}
                onChange={(e) => setManualMinutes(timer.id, e.target.value)}
                placeholder="Min"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <Popover
              open={timer.manualDateOpen}
              onOpenChange={(open) => setManualDateOpen(timer.id, open)}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={CalendarIcon}
                  className="w-full"
                >
                  {timer.manualDate.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[120] w-auto p-2" align="end">
                <DayPicker
                  mode="single"
                  selected={timer.manualDate}
                  onSelect={(d) => {
                    if (d) {
                      setManualDate(timer.id, d);
                      setManualDateOpen(timer.id, false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        {timer.selectedContact ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{contactLabel(timer.selectedContact)}</p>
              {timer.selectedContact.email ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {timer.selectedContact.email}
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
              onClick={() => clearContact(timer.id)}
            />
          </div>
        ) : (
          <Popover
            open={timer.openPopover}
            onOpenChange={(open) => setShowSuggestions(timer.id, open)}
          >
            <PopoverAnchor asChild>
              <div className="relative w-full min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  {...LIST_SEARCH_FIELD_PROPS}
                  name={`homebase-contact-search-${timer.id}`}
                  value={timer.contactSearch}
                  onChange={(event) => {
                    setContactSearch(timer.id, event.target.value);
                    setShowSuggestions(timer.id, true);
                  }}
                  onFocus={() => setShowSuggestions(timer.id, true)}
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
              {timer.filteredSuggestions.length > 0 ? (
                timer.filteredSuggestions.map((contact) => {
                  const name = contactLabel(contact);
                  const meta = [contact.email, contact.phone].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                      onClick={() => selectContact(timer.id, contact)}
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
                  {timer.contactSearch.trim()
                    ? t('common.noResults')
                    : t('tasks.addAssigneePlaceholder')}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        <RoundIconLabelButton
          icon={UserPlus}
          label={timer.adding ? 'Adding…' : 'Add time to contact'}
          variant="soft"
          size="xs"
          alwaysExpanded
          disabled={!timer.canAddToContact || timer.adding}
          onClick={() => void addToContact(timer.id)}
        />
        {timer.addError ? (
          <Text variant="muted" className="text-xs text-destructive">
            {timer.addError}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export function TimerPanel() {
  const { t } = useTranslation();
  const { timers, canAddTimer, addTimer } = useTimer();

  return (
    <div className="space-y-4">
      {timers.map((timer, index) => (
        <TimerSlotCard key={timer.id} timer={timer} index={index} total={timers.length} />
      ))}

      {canAddTimer ? (
        <div className={cn(timers.length > 0 && 'border-t border-border/60 pt-4')}>
          <RoundIconLabelButton
            icon={Plus}
            label={t('rightSidebar.addTimer', {
              defaultValue: 'Add timer',
            })}
            variant="soft"
            size="xs"
            alwaysExpanded
            onClick={addTimer}
            aria-label={t('rightSidebar.addTimer', {
              defaultValue: 'Add timer',
            })}
          />
        </div>
      ) : null}
    </div>
  );
}
