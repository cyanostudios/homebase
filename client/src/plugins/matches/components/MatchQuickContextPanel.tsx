import { CalendarDays, Info, MapPin, Trophy, User, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { QuickContextSection } from '@/core/ui/QuickContextSection';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { DETAIL_FIELD_VALUE_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import {
  AssignmentQuickInfoDialog,
  type AssignmentQuickInfoDetail,
} from '@/plugins/contacts/components/AssignmentQuickInfoDialog';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { Team } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { formatMatchDateTime, formatMatchScore, type Match } from '../types/match';

import { MatchStatusBadges } from './MatchStatusBadges';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function matchLabel(match: Match): string {
  return match.name?.trim() || `${match.home_team} – ${match.away_team}`;
}

function matchInitials(match: Match): string {
  const home = match.home_team?.trim().slice(0, 1).toUpperCase() ?? '';
  const away = match.away_team?.trim().slice(0, 1).toUpperCase() ?? '';
  if (home && away) {
    return `${home}${away}`;
  }
  return matchLabel(match).slice(0, 2).toUpperCase() || '—';
}

export function MatchQuickContextPanel({
  match,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
}: {
  match: Match;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [showTeamQuickInfo, setShowTeamQuickInfo] = useState(false);

  useEffect(() => {
    setViewingContact(null);
    setShowTeamQuickInfo(false);
  }, [match.id]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts ?? []) {
      map.set(String(contact.id), contact as Contact);
    }
    return map;
  }, [contacts]);

  const uniqueMentions = useMemo(() => {
    const mentions = Array.isArray(match.mentions) ? match.mentions : [];
    return Array.from(new Map(mentions.map((m) => [m.contactId, m])).values());
  }, [match.mentions]);

  const linkedTeam = useMemo((): Team | null => {
    if (!hasTeamsPlugin || match.team_id == null) {
      return null;
    }
    return teams.find((item) => String(item.id) === String(match.team_id)) ?? null;
  }, [hasTeamsPlugin, match.team_id, teams]);

  const linkedTeamLabel = linkedTeam ? formatTeamLabel(linkedTeam) || linkedTeam.name : null;

  const teamQuickInfoDetails = useMemo((): AssignmentQuickInfoDetail[] => {
    if (!linkedTeam) {
      return [];
    }
    const details: AssignmentQuickInfoDetail[] = [
      {
        icon: User,
        label: t('teams.form.statusLabel'),
        value: t(`teams.status.${linkedTeam.status}`),
      },
    ];
    if (linkedTeam.age_group?.trim()) {
      details.push({
        icon: Users,
        label: t('teams.form.ageGroupLabel'),
        value: linkedTeam.age_group.trim(),
      });
    }
    if (linkedTeam.gender) {
      details.push({
        icon: Users,
        label: t('teams.form.genderLabel'),
        value: t(`teams.gender.${linkedTeam.gender}`),
      });
    }
    if (linkedTeam.playing_format) {
      details.push({
        icon: Trophy,
        label: t('teams.form.playingFormatLabel'),
        value: linkedTeam.playing_format,
      });
    }
    return details;
  }, [linkedTeam, t]);

  const title = matchLabel(match);
  const score = formatMatchScore(match);
  const whenLabel = match.start_time ? formatMatchDateTime(match.start_time, i18n.language) : null;
  const updatedLabel = match.updated_at
    ? new Date(match.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const navigateToContact = (contact: Contact) => {
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts ?? [], 'companyName')}`);
  };

  const openAssignedTeam = (team: Team) => {
    setShowTeamQuickInfo(false);
    navigate(`/teams/${buildSlug(team, teams, 'name')}`);
  };

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        aria-hidden
      >
        {matchInitials(match)}
      </div>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1')}>{title}</h3>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  return (
    <>
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">{identityHeader}</div>

        <div
          className={cn(
            'min-w-0 overflow-x-hidden px-4 py-4',
            isFullView ? 'space-y-4' : 'space-y-6',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {updatedLabel ? (
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {t('common.updated')} {updatedLabel}
              </p>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {score ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Badge className={cn('shrink-0', BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS.success)}>
                  {score}
                </Badge>
              </div>
            ) : null}
          </div>

          {!isFullView ? (
            <QuickContextSection title={t('matches.information')} icon={Info} iconPlugin="matches">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <div className={FACT_LABEL_CLASS}>{t('matches.status')}</div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    <MatchStatusBadges
                      match={match}
                      showEmptyPlaceholder
                      emptyPlaceholderClassName="text-muted-foreground"
                    />
                  </div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <CalendarDays className="h-3 w-3" />
                    {t('matches.timeLabel')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{whenLabel || '—'}</div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <MapPin className="h-3 w-3" />
                    {t('matches.locationLabel')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{match.location?.trim() || '—'}</div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>{t('matches.homeTeamLabel')}</div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{match.home_team || '—'}</div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>{t('matches.awayTeamLabel')}</div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{match.away_team || '—'}</div>
                </div>
                {match.competition_name?.trim() ? (
                  <div>
                    <div className={FACT_LABEL_CLASS}>
                      <Trophy className="h-3 w-3" />
                      {t('matches.competitionName')}
                    </div>
                    <div className={DETAIL_FIELD_VALUE_CLASS}>{match.competition_name.trim()}</div>
                  </div>
                ) : null}
                {match.sport_type ? (
                  <div>
                    <div className={FACT_LABEL_CLASS}>{t('matches.sport')}</div>
                    <div className={DETAIL_FIELD_VALUE_CLASS}>
                      {[match.sport_type, match.format].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ) : null}
              </div>
            </QuickContextSection>
          ) : null}

          {!isFullView && linkedTeam && linkedTeamLabel ? (
            <QuickContextSection title={t('matches.team')} icon={Users} iconPlugin="teams">
              <QuickContextLinkTileGrid>
                <QuickContextLinkTile
                  label={t('nav.team')}
                  meta={
                    linkedTeam.playing_format
                      ? String(linkedTeam.playing_format)
                      : linkedTeam.gender
                        ? t(`teams.gender.${linkedTeam.gender}`)
                        : null
                  }
                  icon={Users}
                  iconClassName="text-emerald-600"
                  onClick={() => setShowTeamQuickInfo(true)}
                >
                  {linkedTeamLabel}
                </QuickContextLinkTile>
              </QuickContextLinkTileGrid>
            </QuickContextSection>
          ) : null}

          {!isFullView && uniqueMentions.length > 0 ? (
            <QuickContextSection
              title={t('matches.quickContext.contacts')}
              icon={User}
              iconPlugin="contacts"
            >
              <QuickContextLinkTileGrid>
                {uniqueMentions.slice(0, 6).map((mention) => {
                  const contactData = contactById.get(String(mention.contactId));
                  const isDeleted = !contactData;
                  const name =
                    contactData?.companyName ??
                    mention.contactName ??
                    mention.companyName ??
                    mention.contactId;
                  const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
                  return (
                    <QuickContextLinkTile
                      key={mention.contactId}
                      label={t('nav.contact')}
                      meta={
                        isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)
                      }
                      metaClassName={
                        isDeleted
                          ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          : CONTACT_TYPE_COLORS[typeKey]
                      }
                      icon={User}
                      iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                      onClick={contactData ? () => setViewingContact(contactData) : undefined}
                      className={isDeleted ? 'opacity-70' : undefined}
                    >
                      {name}
                    </QuickContextLinkTile>
                  );
                })}
              </QuickContextLinkTileGrid>
            </QuickContextSection>
          ) : null}
        </div>

        {!isFullView && onOpenFullProfile ? (
          <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
        ) : null}
      </Card>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />

      <AssignmentQuickInfoDialog
        isOpen={showTeamQuickInfo && linkedTeam !== null}
        title={linkedTeamLabel || linkedTeam?.name || ''}
        icon={Users}
        details={teamQuickInfoDetails}
        openLabel={t('contacts.openTeam')}
        onClose={() => setShowTeamQuickInfo(false)}
        onOpen={() => {
          if (linkedTeam) {
            openAssignedTeam(linkedTeam);
          }
        }}
      />
    </>
  );
}
