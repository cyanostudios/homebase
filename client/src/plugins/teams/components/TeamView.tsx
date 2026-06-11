import {
  CalendarDays,
  Copy,
  Edit,
  Inbox,
  Info,
  LayoutGrid,
  Mail,
  StickyNote,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { useTeams } from '../hooks/useTeams';
import type { Team, TeamNote } from '../types/teams';
import {
  buildResponsiblesGroupMailto,
  createTeamNoteId,
  formatSeriesTeamLabel,
  getDisplaySeriesTeams,
  getOngoingSeasonBreaks,
  getSeriesTeamColorForName,
  getSeriesTeamDisplayLabel,
  getSeriesTeamOptions,
  responsibleKey,
  isLightTeamColor,
  resolveSeriesTeamColor,
  SEASON_BREAK_HEADER_BADGE_CLASS,
  TEAM_COLOR_GRADIENTS,
} from '../types/teams';

import { ResponsibleContactDialog } from './ResponsibleContactDialog';
import { ResponsibleRow, SeriesTeamBadge } from './ResponsibleRow';
import { SeasonCalendar } from './SeasonCalendar';
import { TeamNotesSection } from './TeamNotesSection';
import { TrainingSchedule } from './TrainingSchedule';
import { requestsApi } from '@/plugins/requests/api/requestsApi';
import { TeamRequestsSection } from '@/plugins/requests/components/TeamRequestsSection';
import { useRequests } from '@/plugins/requests/hooks/useRequests';

type TeamViewTab = 'overview' | 'schedule' | 'responsibles' | 'notes' | 'requests';

const TEAM_VIEW_TABS: TeamViewTab[] = ['overview', 'schedule', 'responsibles', 'notes', 'requests'];

function parseTeamViewTab(value: string | null): TeamViewTab {
  if (value && TEAM_VIEW_TABS.includes(value as TeamViewTab)) {
    return value as TeamViewTab;
  }
  return 'overview';
}

function TeamQuickActionsCard({
  team,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
}: {
  team: Team;
  onEdit: (team: Team) => void;
  onDeleteClick: () => void;
  onDuplicate: () => void;
  getDuplicateConfig: (
    item: Team | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
}) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(team));
  const actionRowClass = DETAIL_QUICK_ACTION_ROW_CLASS;

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('teams.quickActions')} icon={Zap} subtleTitle className="p-4">
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={actionRowClass}
            onClick={() => onEdit(team)}
          >
            {t('common.edit')}
          </Button>
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
            {t('common.delete')}
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
              className={actionRowClass}
              onClick={onDuplicate}
            >
              {t('common.duplicate')}
            </Button>
          )}
        </div>
      </DetailSection>
    </Card>
  );
}

export function TeamView({ team: teamProp, item }: { team?: Team | null; item?: Team | null }) {
  const { t } = useTranslation();
  const { user } = useApp();
  const team = teamProp ?? item ?? null;
  const {
    saveTeam,
    deleteTeam,
    openTeamForEdit,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedTeamId,
  } = useTeams();
  const { contacts, openContactForView } = useContacts();
  const { openRequestForView } = useRequests();
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTeamViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: TeamViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
  const [requestsCount, setRequestsCount] = useState(0);

  useEffect(() => {
    if (!team?.id) {
      setRequestsCount(0);
      return;
    }
    let cancelled = false;
    setRequestsCount(0);
    requestsApi
      .getRequests({ team_id: Number(team.id) })
      .then((data) => {
        if (!cancelled) setRequestsCount(data.length);
      })
      .catch(() => {
        if (!cancelled) setRequestsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [team?.id]);
  const [showResponsiblesEmailDialog, setShowResponsiblesEmailDialog] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingRemoveResponsible, setPendingRemoveResponsible] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [pendingRemoveNote, setPendingRemoveNote] = useState<TeamNote | null>(null);
  const [viewingResponsible, setViewingResponsible] = useState<{
    contact: Contact;
    role: string;
    seriesTeam?: string | null;
  } | null>(null);

  const contactById = useMemo(() => {
    const map = new Map<string, (typeof contacts)[number]>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);

  const seriesTeamOptions = useMemo(() => (team ? getSeriesTeamOptions(team) : []), [team]);
  const hasSeriesTeams = seriesTeamOptions.length > 0;
  const headerSeriesTeams = useMemo(
    () => (team ? getDisplaySeriesTeams(team.series_teams ?? [], team.series_team_count) : []),
    [team],
  );
  const ongoingSeasonBreaks = useMemo(
    () => (team ? getOngoingSeasonBreaks(team.season_breaks ?? []) : []),
    [team],
  );
  const responsiblesEmailRecipients = useMemo((): BulkEmailRecipient[] => {
    if (!team) {
      return [];
    }
    const recipients: BulkEmailRecipient[] = [];
    const seen = new Set<string>();
    for (const responsible of team.responsibles) {
      const contact = contactById.get(responsible.contactId);
      const email = contact?.email?.trim();
      if (!email || !email.includes('@')) {
        continue;
      }
      const key = email.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      recipients.push({
        id: responsible.contactId,
        name: contact?.companyName || `Contact ${responsible.contactId}`,
        email,
      });
    }
    return recipients;
  }, [team, contactById]);
  const responsiblesGroupMailto = useMemo(
    () =>
      team
        ? buildResponsiblesGroupMailto(
            team.responsibles,
            (contactId) => contactById.get(contactId)?.email,
            team.name,
          )
        : null,
    [team, contactById],
  );

  if (!team) {
    return null;
  }

  const persistTeam = async (patch: Partial<Team>) => {
    await saveTeam(
      {
        name: team.name,
        age_group: team.age_group,
        gender: team.gender ?? undefined,
        player_count: team.player_count,
        series_team_count: team.series_team_count,
        series_teams: team.series_teams ?? [],
        status: team.status,
        status_note: team.status_note,
        team_notes: team.team_notes ?? [],
        training_times: team.training_times,
        season_breaks: team.season_breaks,
        responsibles: team.responsibles,
        color: team.color,
        ...patch,
      },
      team.id,
    );
  };

  const addNote = async (text: string) => {
    await persistTeam({
      team_notes: [
        ...(team.team_notes ?? []),
        { id: createTeamNoteId(), text, createdAt: new Date().toISOString() },
      ],
    });
  };

  const removeNote = async (noteId: string) => {
    await persistTeam({
      team_notes: (team.team_notes ?? []).filter((n) => n.id !== noteId),
    });
  };

  const removeResponsible = async (key: string) => {
    await persistTeam({
      responsibles: team.responsibles.filter((r) => responsibleKey(r) !== key),
    });
  };

  const showResponsibleContact = (contact: Contact, role: string, seriesTeam?: string | null) => {
    setViewingResponsible({ contact, role, seriesTeam });
  };

  const notesCount = team.team_notes?.length ?? 0;

  const tabs: { id: TeamViewTab; label: string; icon: LucideIcon; count?: number }[] = [
    { id: 'overview', label: t('teams.tabs.overview'), icon: LayoutGrid },
    { id: 'schedule', label: t('teams.tabs.schedule'), icon: CalendarDays },
    { id: 'responsibles', label: t('teams.tabs.responsibles'), icon: Users },
    { id: 'notes', label: t('teams.tabs.notes'), icon: StickyNote, count: notesCount },
    { id: 'requests', label: t('teams.tabs.requests'), icon: Inbox, count: requestsCount },
  ];

  const notesListSection = (
    <TeamNotesSection
      notes={team.team_notes ?? []}
      onAdd={addNote}
      onRemoveRequest={setPendingRemoveNote}
      showAdd={false}
    />
  );

  const notesFullSection = (
    <TeamNotesSection
      notes={team.team_notes ?? []}
      onAdd={addNote}
      onRemoveRequest={setPendingRemoveNote}
    />
  );

  const responsiblesSection = (allowRemove: boolean) => (
    <div className="space-y-2">
      {team.responsibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('teams.view.noResponsibles')}</p>
      ) : (
        <div className="space-y-1.5">
          {team.responsibles.map((responsible) => {
            const contact = contactById.get(String(responsible.contactId)) ?? null;
            return (
              <ResponsibleRow
                key={responsibleKey(responsible)}
                responsible={responsible}
                contact={contact}
                hasSeriesTeams={hasSeriesTeams}
                seriesTeamDisplayLabel={getSeriesTeamDisplayLabel(team, responsible.seriesTeam)}
                seriesTeamColor={getSeriesTeamColorForName(team, responsible.seriesTeam)}
                onOpenContact={
                  contact
                    ? () =>
                        showResponsibleContact(contact, responsible.role, responsible.seriesTeam)
                    : undefined
                }
                onRemove={
                  allowRemove
                    ? () =>
                        setPendingRemoveResponsible({
                          key: responsibleKey(responsible),
                          name: contact?.companyName || `Contact ${responsible.contactId}`,
                        })
                    : undefined
                }
              />
            );
          })}
          {allowRemove && responsiblesEmailRecipients.length > 0 ? (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={(props) => (
                  <Mail
                    {...props}
                    className={cn(props.className, 'text-red-600 dark:text-red-400')}
                  />
                )}
                className={DETAIL_QUICK_ACTION_ROW_CLASS}
                onClick={() => {
                  if (canSendEmail) {
                    setShowResponsiblesEmailDialog(true);
                  } else if (responsiblesGroupMailto) {
                    window.location.href = responsiblesGroupMailto;
                  }
                }}
              >
                {t('teams.view.mailToGroup')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <TeamQuickActionsCard
              team={team}
              onEdit={openTeamForEdit}
              onDeleteClick={() => setShowDelete(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
            />
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('teams.view.information')}
                icon={Info}
                subtleTitle
                className="p-4"
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('teams', team.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('teams.form.ageGroupLabel')}
                    </span>
                    <span className="font-semibold text-foreground">{team.age_group || '—'}</span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-semibold text-foreground">
                      {team.updated_at
                        ? new Date(team.updated_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
            <DetailActivityLog
              entityType="team"
              entityId={team.id}
              title={t('teams.activity')}
              limit={5}
              refreshKey={team.updated_at}
            />
          </div>
        }
      >
        <div className="space-y-3">
          <Card
            padding="none"
            className={cn(
              'overflow-hidden rounded-xl bg-gradient-to-br p-5 shadow-sm',
              isLightTeamColor(team.color) ? 'text-foreground' : 'border-0 text-white',
              TEAM_COLOR_GRADIENTS[team.color],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-xs font-medium',
                    isLightTeamColor(team.color) ? 'text-muted-foreground' : 'text-white/70',
                  )}
                >
                  {[team.age_group, team.gender ? t(`teams.gender.${team.gender}`) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <h2 className="mt-0.5 truncate text-2xl font-bold tracking-tight">{team.name}</h2>
              </div>
              <div className="flex max-w-[55%] flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
                {headerSeriesTeams.map((seriesTeam, index) => (
                  <SeriesTeamBadge
                    key={`${seriesTeam.name}-${index}`}
                    label={formatSeriesTeamLabel(seriesTeam)}
                    color={resolveSeriesTeamColor(seriesTeam.color, index)}
                  />
                ))}
                <span
                  className={cn(
                    'inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium',
                    isLightTeamColor(team.color)
                      ? 'bg-foreground/10 text-foreground'
                      : 'bg-white/20 text-white',
                  )}
                >
                  {t(`teams.status.${team.status}`)}
                </span>
                {team.status === 'active'
                  ? ongoingSeasonBreaks.map((seasonBreak, index) => {
                      const label = seasonBreak.name || t('teams.view.seasonBreakActive');
                      return (
                        <span
                          key={`${seasonBreak.startDate}-${seasonBreak.endDate}-${index}`}
                          className={SEASON_BREAK_HEADER_BADGE_CLASS}
                          title={label}
                        >
                          {label}
                        </span>
                      );
                    })
                  : null}
              </div>
            </div>
            <div
              className={cn(
                'mt-5 flex items-center divide-x',
                isLightTeamColor(team.color) ? 'divide-border/60' : 'divide-white/20',
              )}
            >
              {[
                { value: team.player_count, label: t('teams.view.statPlayers') },
                { value: team.series_team_count, label: t('teams.view.statSeriesTeams') },
                { value: team.training_times.length, label: t('teams.view.statTrainingsPerWeek') },
                { value: team.responsibles.length, label: t('teams.view.statResponsibles') },
              ].map((stat, index) => (
                <div key={index} className={cn('flex-1 text-center', index === 0 && 'pl-0')}>
                  <p className="text-xl font-bold leading-none">{stat.value}</p>
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      isLightTeamColor(team.color) ? 'text-muted-foreground' : 'text-white/70',
                    )}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
                    'flex items-center gap-1.5 sm:gap-2',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                      : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>
                    {tab.label}
                    {tab.count != null ? (
                      <>
                        {' '}
                        <span
                          className={cn(
                            'tabular-nums font-semibold',
                            isActive
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-primary',
                          )}
                        >
                          ({tab.count})
                        </span>
                      </>
                    ) : null}
                  </span>
                </Button>
              );
            })}
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-3">
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.view.weeklySchedule')} className="p-4">
                  <TrainingSchedule trainingTimes={team.training_times} variant="overview" />
                </DetailSection>
              </Card>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.view.seasonBreaks')} className="p-4">
                  <SeasonCalendar seasonBreaks={team.season_breaks} omitPast />
                </DetailSection>
              </Card>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.tabs.responsibles')} className="p-4">
                  {responsiblesSection(false)}
                </DetailSection>
              </Card>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.tabs.notes')} className="p-4">
                  {notesListSection}
                </DetailSection>
              </Card>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.tabs.requests')} className="p-4">
                  <TeamRequestsSection
                    teamId={team.id}
                    compact
                    onOpenRequest={openRequestForView}
                  />
                </DetailSection>
              </Card>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-3">
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.view.weeklySchedule')} className="p-4">
                  <TrainingSchedule trainingTimes={team.training_times} variant="detailed" />
                </DetailSection>
              </Card>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('teams.view.seasonCalendar')} className="p-4">
                  <SeasonCalendar seasonBreaks={team.season_breaks} />
                </DetailSection>
              </Card>
            </div>
          )}

          {activeTab === 'responsibles' && (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={t('teams.tabs.responsibles')} className="p-4">
                {responsiblesSection(true)}
              </DetailSection>
            </Card>
          )}

          {activeTab === 'notes' && (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={t('teams.tabs.notes')} className="p-4">
                {notesFullSection}
              </DetailSection>
            </Card>
          )}

          {activeTab === 'requests' && (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={t('teams.tabs.requests')} className="p-4">
                <TeamRequestsSection teamId={team.id} onOpenRequest={openRequestForView} />
              </DetailSection>
            </Card>
          )}
        </div>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDelete}
        title={t('teams.view.deleteTeam')}
        message={t('teams.view.deleteConfirm', { name: team.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDelete(false);
          await deleteTeam(team.id);
        }}
        onCancel={() => setShowDelete(false)}
        variant="danger"
      />
      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(team, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedTeamId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(team)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(team)?.nameLabel ?? t('teams.form.nameLabel')}
        confirmOnly={Boolean(getDuplicateConfig(team)?.confirmOnly)}
      />
      <ConfirmDialog
        isOpen={pendingRemoveResponsible !== null}
        title={t('teams.view.removeResponsible')}
        message={t('teams.view.removeResponsibleConfirm', {
          name: pendingRemoveResponsible?.name ?? '',
        })}
        confirmText={t('teams.view.removeResponsible')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          if (!pendingRemoveResponsible) {
            return;
          }
          const { key } = pendingRemoveResponsible;
          setPendingRemoveResponsible(null);
          await removeResponsible(key);
        }}
        onCancel={() => setPendingRemoveResponsible(null)}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={pendingRemoveNote !== null}
        title={t('teams.view.removeNote')}
        message={t('teams.view.removeNoteConfirm')}
        confirmText={t('teams.view.removeNote')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          if (!pendingRemoveNote) {
            return;
          }
          const { id } = pendingRemoveNote;
          setPendingRemoveNote(null);
          await removeNote(id);
        }}
        onCancel={() => setPendingRemoveNote(null)}
        variant="warning"
      />
      <ResponsibleContactDialog
        isOpen={viewingResponsible !== null}
        contact={viewingResponsible?.contact ?? null}
        role={viewingResponsible?.role}
        seriesTeam={viewingResponsible?.seriesTeam}
        seriesTeams={team.series_teams ?? []}
        hasSeriesTeams={hasSeriesTeams}
        onClose={() => setViewingResponsible(null)}
        onOpenContact={() => {
          if (!viewingResponsible) {
            return;
          }
          openContactForView(viewingResponsible.contact);
          setViewingResponsible(null);
        }}
      />
      <BulkEmailDialog
        isOpen={showResponsiblesEmailDialog}
        onClose={() => setShowResponsiblesEmailDialog(false)}
        recipients={responsiblesEmailRecipients}
        pluginSource="teams"
      />
    </>
  );
}
