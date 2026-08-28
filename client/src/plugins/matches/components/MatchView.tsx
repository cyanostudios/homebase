import { ExternalLink, Info, Search, Trash2, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, type DetailSectionIconPlugin } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDateTime } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  collectContactTags,
  contactMatchesTagFilter,
} from '@/plugins/contacts/utils/contactListFilter';
import { useSlotsContext } from '@/plugins/slots/context/SlotsContext';

import { useMatchContext } from '../context/MatchContext';
import { MatchTeamBadge } from './MatchTeamBadge';
import { MatchStatusBadges } from './MatchStatusBadges';
import { formatMatchScore, hasMatchResult, type Match } from '../types/match';

interface MatchViewProps {
  match?: Match;
  item?: Match;
}

type AssignableContact = {
  id: string | number;
  companyName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  isAssignable?: boolean;
  tags?: string[];
};

type RelatedItem = { id: string | number; label: string; onOpen: () => void; pluginClass: string };

interface MatchMainInfoCardProps {
  match: Match;
  sportLabel: string;
}

/** Match Slots-style top card: single white panel, uppercase labels, grid layout (see SlotMainInfoCard). */
function MatchMainInfoCard({ match, sportLabel }: MatchMainInfoCardProps) {
  const { t } = useTranslation();
  const displayName =
    match.name?.trim() ||
    [match.home_team, match.away_team].filter(Boolean).join(' – ').trim() ||
    '—';
  const matchTypeLabel =
    match.match_type === 'series'
      ? t('matches.matchTypeSeries')
      : match.match_type === 'cup'
        ? t('matches.matchTypeCup')
        : match.match_type === 'friendly'
          ? t('matches.matchTypeFriendly')
          : '—';
  const minutesLabel =
    match.total_minutes !== null && match.total_minutes !== undefined
      ? `${match.total_minutes} min`
      : '—';
  const scoreLabel = formatMatchScore(match);
  const showResult = hasMatchResult(match);

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-matches')}>
      <div className="space-y-5 p-6">
        {/* Name + team badge */}
        <div>
          <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.nameLabel')}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className={cn(PLUGIN_PAGE_TITLE_CLASS, 'whitespace-normal')}>{displayName}</span>
            {match.team_id ? <MatchTeamBadge teamId={match.team_id} size="header" /> : null}
          </div>
        </div>

        {/* Home / Away (same row) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.homeTeamLabel')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>
              {match.home_team?.trim() ? match.home_team : '—'}
            </div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.awayTeamLabel')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>
              {match.away_team?.trim() ? match.away_team : '—'}
            </div>
          </div>
        </div>

        {/* Number + Location (same row) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.matchNumber')}</div>
            <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>
              {match.match_number !== null && match.match_number !== undefined
                ? String(match.match_number)
                : '—'}
            </div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.dateTimePlaceholder')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>
              {match.start_time ? formatDateTime(match.start_time) : '—'}
            </div>
          </div>
        </div>

        {/* Location + Map link (same row) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.locationLabel')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>
              {match.location?.trim() ? match.location : '—'}
            </div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.mapLink')}</div>
            {match.map_link?.trim() ? (
              <a
                href={match.map_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-plugin hover:underline"
              >
                {t('matches.openMap')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className={DETAIL_FIELD_VALUE_CLASS}>—</div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 pt-4" />

        {/* Sport / Format / Minutes (same row) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.sport')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>{sportLabel}</div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.format')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>{match.format || '—'}</div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.minutes')}</div>
            <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>{minutesLabel}</div>
          </div>
        </div>

        {/* Type / Referees / Competition (same row) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.matchType')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>{matchTypeLabel}</div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.refereeCount')}</div>
            <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>
              {match.referee_count ?? 1}
            </div>
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.competitionName')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>
              {match.competition_name?.trim() ? match.competition_name : '—'}
            </div>
          </div>
        </div>

        {(showResult || match.is_canceled || match.is_postponed || match.is_finished) && (
          <>
            <div className="border-t border-border/50 pt-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.result')}</div>
                <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-lg font-semibold tabular-nums')}>
                  {scoreLabel || '—'}
                </div>
              </div>
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.status')}</div>
                <div className="mt-1">
                  <MatchStatusBadges
                    match={match}
                    showEmptyPlaceholder
                    emptyPlaceholderClassName={DETAIL_FIELD_VALUE_CLASS}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function RelatedItemsCard({
  title,
  icon: Icon,
  iconPlugin,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconPlugin: DetailSectionIconPlugin;
  items: RelatedItem[];
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return null;
  }
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={title} icon={Icon} iconPlugin={iconPlugin} subtleTitle className="p-4">
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={`${title}-${item.id}`}
              className={cn(DETAIL_SURFACE_ROW_CLASS, item.pluginClass)}
            >
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={ExternalLink}
                className={cn(DETAIL_ENTITY_LINK_TRIGGER_CLASS, item.pluginClass)}
                onClick={item.onOpen}
              >
                {t('common.open')}
              </Button>
            </div>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}

export function MatchView({ match: matchProp, item }: MatchViewProps) {
  const { t } = useTranslation();
  const match = matchProp ?? item ?? null;
  const { contacts, openContactForView } = useContacts();
  const { user, openSlotForView } = useApp();
  const allContacts = contacts as AssignableContact[];
  const assignableContacts = useMemo(
    () => allContacts.filter((c) => c.isAssignable !== false),
    [allContacts],
  );
  const contactsById = useMemo(() => {
    const map = new Map<string, AssignableContact>();
    for (const contact of allContacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [allContacts]);
  const viewableContactsById = useMemo(() => {
    const map = new Map<string, (typeof contacts)[number]>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);
  const {
    showQuickActionDialog,
    quickActionDialogMessage,
    closeQuickActionDialog,
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useMatchContext();

  const [contactSearch, setContactSearch] = useState('');
  const [contactTagFilter, setContactTagFilter] = useState('all');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [pendingRemoveContactId, setPendingRemoveContactId] = useState<string | null>(null);
  const [pendingRemoveContactName, setPendingRemoveContactName] = useState<string>('');
  const { slots: allSlots } = useSlotsContext();

  const availableContactTags = useMemo(
    () => collectContactTags(assignableContacts),
    [assignableContacts],
  );

  const unattachedContacts = useMemo(
    () =>
      assignableContacts.filter(
        (c) => !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
      ),
    [assignableContacts, displayMentions],
  );

  const addableContacts = useMemo(
    () => unattachedContacts.filter((c) => contactMatchesTagFilter(c, contactTagFilter)),
    [unattachedContacts, contactTagFilter],
  );

  const filteredContactSuggestions = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return addableContacts;
    }
    return addableContacts.filter((contact) => {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      return [
        contact.companyName,
        contact.name,
        fullName,
        contact.email,
        contact.phone,
        contact.phone2,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [addableContacts, contactSearch]);

  const sportLabel =
    match?.sport_type === 'football' ? t('matches.football') : t('matches.handball');
  const matchId = match?.id;
  const hasSlotsPlugin = Boolean(user?.plugins?.includes('slots'));

  const relatedSlots = useMemo(() => {
    if (!hasSlotsPlugin || !matchId) {
      return [];
    }
    return allSlots.filter((slot) => String(slot.match_id ?? '') === String(matchId));
  }, [hasSlotsPlugin, matchId, allSlots]);

  if (!match) {
    return null;
  }

  return (
    <>
      <DetailLayout
        sidebar={
          hasSlotsPlugin ? (
            <div className="space-y-4">
              {relatedSlots.length === 0 ? (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                  <DetailSection
                    title={t('matches.relatedSlots')}
                    icon={Info}
                    iconPlugin="slots"
                    className="p-4"
                  >
                    <p className="text-sm text-muted-foreground">{t('matches.noRelatedSlots')}</p>
                  </DetailSection>
                </Card>
              ) : (
                <RelatedItemsCard
                  title={t('matches.relatedSlots')}
                  icon={Info}
                  iconPlugin="slots"
                  items={relatedSlots.map((s) => ({
                    id: s.id,
                    label: s.location?.trim()
                      ? `${s.location} · ${formatDateTime(s.slot_time)}`
                      : formatDateTime(s.slot_time),
                    pluginClass: 'plugin-slots',
                    onOpen: () => {
                      if (openSlotForView) {
                        openSlotForView(s);
                      }
                    },
                  }))}
                />
              )}
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4 plugin-matches">
          <MatchMainInfoCard match={match} sportLabel={sportLabel} />

          <Card
            padding="none"
            className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-matches overflow-visible relative z-30')}
          >
            <div className="p-6 space-y-2">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t('matches.contacts')}
                  </span>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                  {availableContactTags.length > 0 ? (
                    <Select
                      value={contactTagFilter}
                      onValueChange={(value) => {
                        setContactTagFilter(value);
                        setShowContactSuggestions(false);
                      }}
                    >
                      <SelectTrigger
                        className="h-9 w-full bg-background text-xs sm:w-[160px] sm:shrink-0"
                        aria-label={t('matches.filterContactsByTag')}
                      >
                        <SelectValue placeholder={t('matches.filterContactsByTag')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('matches.allContactTags')}</SelectItem>
                        {availableContactTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Popover
                    open={showContactSuggestions && unattachedContacts.length > 0}
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
                            unattachedContacts.length === 0
                              ? t('matches.noMoreToAdd')
                              : t('matches.addContact')
                          }
                          className="h-9 bg-background pl-9 text-xs"
                          disabled={unattachedContacts.length === 0}
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
                          const contactMeta = [contact.email, contact.phone]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <button
                              key={String(contact.id)}
                              type="button"
                              className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                              onClick={() => {
                                addContactToDraft(contact);
                                setContactSearch('');
                                setShowContactSuggestions(false);
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
                          {contactSearch.trim() || contactTagFilter !== 'all'
                            ? t('matches.noResults')
                            : t('matches.addContact')}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {displayMentions && displayMentions.length > 0 && (
                <div className="space-y-2 pt-0.5">
                  {displayMentions.map((m) => {
                    const contact = contactsById.get(String(m.contactId));
                    const contactForView = viewableContactsById.get(String(m.contactId));
                    const name = contact?.companyName ?? m.contactName ?? m.contactId;
                    const meta = [contact?.email, contact?.phone, contact?.phone2].filter(Boolean);
                    return (
                      <div key={m.contactId} className="rounded-lg border border-border p-4">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">{name}</span>
                              {contactForView && (
                                <Button
                                  size="sm"
                                  variant="link"
                                  onClick={() => openContactForView(contactForView)}
                                  className="h-auto p-0 text-[10px] shrink-0 font-medium text-plugin"
                                >
                                  {t('matches.view')}
                                </Button>
                              )}
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
                                setPendingRemoveContactId(m.contactId);
                                setPendingRemoveContactName(name as string);
                              }}
                              aria-label={`${t('matches.removeContact')} ${name}`}
                            >
                              {t('matches.delete')}
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
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('matches.discardQuickEditMessage')}
        confirmText={t('matches.discard')}
        cancelText={t('matches.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showQuickActionDialog}
        title={t('matches.quickActionUnavailable')}
        message={quickActionDialogMessage}
        confirmText={t('common.close')}
        onConfirm={closeQuickActionDialog}
        onCancel={closeQuickActionDialog}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={pendingRemoveContactId !== null}
        title={t('matches.removeContactTitle')}
        message={t('matches.removeContactMessage', { name: pendingRemoveContactName })}
        confirmText={t('matches.delete')}
        cancelText={t('matches.cancel')}
        onConfirm={() => {
          if (pendingRemoveContactId) {
            removeContactFromDraft(pendingRemoveContactId);
          }
          setPendingRemoveContactId(null);
          setPendingRemoveContactName('');
        }}
        onCancel={() => {
          setPendingRemoveContactId(null);
          setPendingRemoveContactName('');
        }}
        variant="danger"
      />
    </>
  );
}
