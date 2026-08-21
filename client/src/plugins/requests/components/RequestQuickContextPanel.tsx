import { Edit, ExternalLink, Flag, Inbox, Trophy, User, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DETAIL_PROP_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
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

import type { Request, RequestPriority, RequestStatus } from '../types/requests';
import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_STATUS_COLORS,
  formatRequestStatusForDisplay,
  getTypeLabel,
} from '../types/requests';

import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestStatusSelect } from './RequestStatusSelect';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function requestInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return title.trim().slice(0, 2).toUpperCase() || '—';
}

export function RequestQuickContextPanel({
  request,
  onClose,
  onOpenFullProfile,
  onEdit,
  onStatusChange,
  onPriorityChange,
  variant = 'list',
}: {
  request: Request;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  onStatusChange?: (status: RequestStatus) => void;
  onPriorityChange?: (priority: RequestPriority) => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const canQuickEdit = !isFullView && Boolean(onStatusChange && onPriorityChange);
  const { t } = useTranslation();
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
  }, [request.id]);

  const assignedContacts = useMemo(() => {
    const ids = Array.isArray(request.assignedToIds) ? request.assignedToIds : [];
    return ids
      .map((id) => contacts?.find((c: { id: string | number }) => String(c.id) === String(id)))
      .filter((contact): contact is Contact => Boolean(contact));
  }, [contacts, request.assignedToIds]);

  const assignedTeam = useMemo((): Team | null => {
    if (!hasTeamsPlugin || request.teamId == null) {
      return null;
    }
    return teams.find((item) => String(item.id) === String(request.teamId)) ?? null;
  }, [hasTeamsPlugin, request.teamId, teams]);

  const teamName = assignedTeam ? formatTeamLabel(assignedTeam) || assignedTeam.name : null;

  const teamQuickInfoDetails = useMemo((): AssignmentQuickInfoDetail[] => {
    if (!assignedTeam) {
      return [];
    }
    const details: AssignmentQuickInfoDetail[] = [
      {
        icon: User,
        label: t('teams.form.statusLabel'),
        value: t(`teams.status.${assignedTeam.status}`),
      },
    ];
    if (assignedTeam.age_group?.trim()) {
      details.push({
        icon: Users,
        label: t('teams.form.ageGroupLabel'),
        value: assignedTeam.age_group.trim(),
      });
    }
    if (assignedTeam.gender) {
      details.push({
        icon: Users,
        label: t('teams.form.genderLabel'),
        value: t(`teams.gender.${assignedTeam.gender}`),
      });
    }
    if (assignedTeam.playing_format) {
      details.push({
        icon: Trophy,
        label: t('teams.form.playingFormatLabel'),
        value: assignedTeam.playing_format,
      });
    }
    return details;
  }, [assignedTeam, t]);

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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-900 dark:bg-purple-950/50 dark:text-purple-200"
        aria-hidden
      >
        {requestInitials(request.title)}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {request.title || '—'}
        </h3>
        <Badge className={cn('shrink-0', BADGE_CLASS, REQUEST_STATUS_COLORS[request.status])}>
          {formatRequestStatusForDisplay(request.status, t)}
        </Badge>
      </div>
      {!isFullView && onOpenFullProfile ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={ExternalLink}
          className="h-8 w-8 shrink-0 p-0"
          onClick={onOpenFullProfile}
          aria-label={t('requests.quickContext.openFullProfile')}
          title={t('requests.quickContext.openFullProfile')}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={Edit}
        className="h-8 w-8 shrink-0 p-0"
        onClick={onEdit}
        aria-label={t('common.edit')}
        title={t('common.edit')}
      />
      {!isFullView && onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={X}
          className="h-8 w-8 shrink-0 p-0"
          onClick={onClose}
          aria-label={t('common.close')}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <Card
        padding="none"
        className={cn(
          DETAIL_VIEW_CARD_CLASS,
          'flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden',
        )}
      >
        <div className="border-b border-border/50 px-4 py-2.5">{identityHeader}</div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-4',
            isFullView ? 'space-y-4' : 'space-y-6',
          )}
        >
          <QuickContextLinkTileGrid>
            <QuickContextLinkTile label={t('requests.form.requestType')} icon={Inbox}>
              {getTypeLabel(request.requestType, t)}
            </QuickContextLinkTile>
            <QuickContextLinkTile label={t('requests.form.submitterName')} icon={User}>
              {request.submitterName?.trim() || '—'}
            </QuickContextLinkTile>
          </QuickContextLinkTileGrid>

          {canQuickEdit ? (
            <div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('requests.form.status')}
                </span>
                <RequestStatusSelect
                  request={request}
                  onStatusChange={onStatusChange!}
                  hideInlineLabel
                  compact
                />
              </div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('requests.form.priority')}
                </span>
                <RequestPrioritySelect
                  request={request}
                  onPriorityChange={onPriorityChange!}
                  hideInlineLabel
                  compact
                />
              </div>
            </div>
          ) : (
            <QuickContextLinkTileGrid>
              <QuickContextLinkTile label={t('requests.form.priority')} icon={Flag}>
                <Badge className={cn(BADGE_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}>
                  {request.priority}
                </Badge>
              </QuickContextLinkTile>
            </QuickContextLinkTileGrid>
          )}

          {!isFullView && (assignedContacts.length > 0 || teamName) ? (
            <QuickContextLinkTileGrid>
              {assignedContacts.map((assignedContact) => {
                const typeKey = assignedContact.contactType === 'private' ? 'private' : 'company';
                return (
                  <QuickContextLinkTile
                    key={`assignee-${assignedContact.id}`}
                    label={t('nav.contact')}
                    meta={t(`contacts.type.${typeKey}`)}
                    metaClassName={CONTACT_TYPE_COLORS[typeKey]}
                    icon={User}
                    iconClassName="text-sky-600"
                    onClick={() => setViewingContact(assignedContact)}
                  >
                    {assignedContact.companyName ?? `Contact ${assignedContact.id}`}
                  </QuickContextLinkTile>
                );
              })}
              {assignedTeam && teamName ? (
                <QuickContextLinkTile
                  label={t('nav.team')}
                  meta={
                    assignedTeam.playing_format
                      ? String(assignedTeam.playing_format)
                      : assignedTeam.gender
                        ? t(`teams.gender.${assignedTeam.gender}`)
                        : null
                  }
                  icon={Users}
                  iconClassName="text-emerald-600"
                  onClick={() => setShowTeamQuickInfo(true)}
                >
                  {teamName}
                </QuickContextLinkTile>
              ) : null}
            </QuickContextLinkTileGrid>
          ) : null}
        </div>

        {!isFullView && onOpenFullProfile ? (
          <div className="border-t border-border/50 px-4 py-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-9 w-full text-xs"
              onClick={onOpenFullProfile}
            >
              {t('requests.quickContext.openFullProfile')}
            </Button>
          </div>
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
        isOpen={showTeamQuickInfo && assignedTeam !== null}
        title={teamName || assignedTeam?.name || ''}
        icon={Users}
        details={teamQuickInfoDetails}
        openLabel={t('contacts.openTeam')}
        onClose={() => setShowTeamQuickInfo(false)}
        onOpen={() => {
          if (assignedTeam) {
            openAssignedTeam(assignedTeam);
          }
        }}
      />
    </>
  );
}
