import {
  Copy,
  ExternalLink,
  Info,
  Search,
  Trash2,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { slotsApi } from '@/plugins/slots/api/slotsApi';
import type { Slot } from '@/plugins/slots/types/slots';

import { useMatchContext } from '../context/MatchContext';
import type { Match } from '../types/match';

interface MatchViewProps {
  match?: Match;
  item?: Match;
}

interface MatchQuickActionsCardProps {
  match: Match;
  onDeleteClick: () => void;
  onDuplicate: () => void;
  getDuplicateConfig: (
    item: Match | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    onClick: (item: Match) => void;
    className?: string;
    disabled?: boolean;
  }>;
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
};

type RelatedItem = { id: string | number; label: string; onOpen: () => void; pluginClass: string };

function MatchQuickActionsCard({
  match,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
}: MatchQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(match));
  const getActionIconColorClass = (actionId: string) => {
    if (actionId === 'create-slot-from-match') {
      return 'text-green-600 dark:text-green-400';
    }
    return '';
  };

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('matches.quickActions')}
        icon={Zap}
        iconPlugin="matches"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
            onClick={onDeleteClick}
          >
            {t('matches.delete')}
          </Button>

          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={onDuplicate}
            >
              {t('matches.duplicate')}
            </Button>
          )}

          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              const tint = getActionIconColorClass(action.id);
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={(props) => <Icon {...props} className={cn(props.className, tint)} />}
                  disabled={action.disabled}
                  className={cn(
                    DETAIL_QUICK_ACTION_ROW_CLASS,
                    'disabled:opacity-50',
                    action.className,
                  )}
                  onClick={() => action.onClick(match)}
                >
                  {action.label}
                </Button>
              );
            })}
        </div>
      </DetailSection>
    </Card>
  );
}

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

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-matches')}>
      <div className="space-y-5 p-6">
        {/* Name (own row) */}
        <div>
          <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.nameLabel')}</div>
          <div className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">
            {displayName}
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
              {match.start_time ? new Date(match.start_time).toLocaleString('sv-SE') : '—'}
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

        {/* Type / Referees / Future (same row) */}
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
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('matches.futureInfo')}</div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>—</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MatchMetadataCard({ match }: { match: Match }) {
  const { t } = useTranslation();
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('matches.information')}
        icon={Info}
        iconPlugin="matches"
        subtleTitle
        className="p-4"
      >
        <div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">ID</span>
            <span className="font-mono font-semibold text-foreground">
              {formatDisplayNumber('matches', match.id)}
            </span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('matches.created')}</span>
            <span className="font-mono font-semibold text-foreground">
              {match.created_at ? new Date(match.created_at).toLocaleDateString('sv-SE') : '—'}
            </span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('matches.updated')}</span>
            <span className="font-mono font-semibold text-foreground">
              {match.updated_at ? new Date(match.updated_at).toLocaleDateString('sv-SE') : '—'}
            </span>
          </div>
        </div>
      </DetailSection>
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
  iconPlugin: string;
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
                className="h-7 w-7 shrink-0 p-0 hover:bg-accent"
                onClick={item.onOpen}
              >
                <span className="sr-only">{t('matches.open')}</span>
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
  const { contacts: appContacts, user, openSlotForView } = useApp();
  const allContacts = (appContacts ?? contacts) as AssignableContact[];
  const assignableContacts = allContacts.filter((c) => c.isAssignable !== false);
  const {
    getDeleteMessage,
    deleteMatch,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedMatchId,
    detailFooterActions,
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
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingRemoveContactId, setPendingRemoveContactId] = useState<string | null>(null);
  const [pendingRemoveContactName, setPendingRemoveContactName] = useState<string>('');
  const [relatedSlots, setRelatedSlots] = useState<Slot[]>([]);
  const [relatedSlotsLoading, setRelatedSlotsLoading] = useState(false);

  const addableContacts = useMemo(
    () =>
      assignableContacts.filter(
        (c) => !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
      ),
    [assignableContacts, displayMentions],
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

  useEffect(() => {
    let cancelled = false;
    if (!hasSlotsPlugin || !matchId) {
      setRelatedSlots([]);
      return;
    }
    setRelatedSlotsLoading(true);
    slotsApi
      .getSlots()
      .then((slots) => {
        if (cancelled) {
          return;
        }
        const filtered = (slots ?? []).filter((s) => String(s.match_id ?? '') === String(matchId));
        setRelatedSlots(filtered);
      })
      .catch(() => {
        if (!cancelled) {
          setRelatedSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRelatedSlotsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasSlotsPlugin, matchId]);

  if (!match) {
    return null;
  }

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <MatchQuickActionsCard
              match={match}
              onDeleteClick={() => setShowDeleteConfirm(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
              detailFooterActions={detailFooterActions}
            />
            <MatchMetadataCard match={match} />
            {hasSlotsPlugin && (
              <>
                {relatedSlotsLoading ? (
                  <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                    <DetailSection
                      title={t('matches.relatedSlots')}
                      icon={Info}
                      iconPlugin="slots"
                      className="p-4"
                    >
                      <p className="text-sm text-muted-foreground">{t('matches.loading')}</p>
                    </DetailSection>
                  </Card>
                ) : relatedSlots.length === 0 ? (
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
                        ? `${s.location} · ${new Date(s.slot_time).toLocaleString('sv-SE')}`
                        : new Date(s.slot_time).toLocaleString('sv-SE'),
                      pluginClass: 'plugin-slots',
                      onOpen: () => {
                        if (openSlotForView) {
                          openSlotForView(s);
                        }
                      },
                    }))}
                  />
                )}
              </>
            )}
            <DetailActivityLog
              entityType="match"
              entityId={match.id}
              limit={30}
              title={t('matches.activity')}
              showClearButton
              refreshKey={match.updated_at ?? match.id}
            />
          </div>
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
                <Popover
                  open={showContactSuggestions && addableContacts.length > 0}
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
                          addableContacts.length === 0
                            ? t('matches.noMoreToAdd')
                            : t('matches.addContact')
                        }
                        className="h-9 bg-background pl-9 text-xs"
                        disabled={addableContacts.length === 0}
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
                        {contactSearch.trim() ? t('matches.noResults') : t('matches.addContact')}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {displayMentions && displayMentions.length > 0 && (
                <div className="space-y-2 pt-0.5">
                  {displayMentions.map((m) => {
                    const contact = allContacts.find((c) => String(c.id) === String(m.contactId));
                    const contactForView = contacts.find(
                      (c) => String(c.id) === String(m.contactId),
                    );
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
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.match') })}
        message={match ? getDeleteMessage(match) : ''}
        confirmText={t('matches.delete')}
        cancelText={t('matches.cancel')}
        onConfirm={async () => {
          await deleteMatch(match.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(match, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedMatchId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(match)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(match)?.nameLabel ?? t('matches.duplicateNameLabel')}
        confirmOnly={Boolean(getDuplicateConfig(match)?.confirmOnly)}
      />

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
        cancelText={t('common.close')}
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
