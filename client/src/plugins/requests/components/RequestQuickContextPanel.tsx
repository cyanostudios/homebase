import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Inbox,
  Mail,
  Phone,
  Tag,
  Trophy,
  User,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import {
  AssignmentQuickInfoDialog,
  type AssignmentQuickInfoDetail,
} from '@/plugins/contacts/components/AssignmentQuickInfoDialog';
import {
  ContactCopyableLink,
  mailtoHref,
  telHref,
} from '@/plugins/contacts/components/ContactCopyableLink';
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
  REQUEST_STATUS_ICON_SHELL_CLASS,
  REQUEST_TYPE_ICON_SHELL_CLASS,
  RESPONSE_DUE_URGENCY_COLORS,
  formatRequestStatusForDisplay,
  formatSubmittedDateWithAge,
  getDaysUntilResponseDue,
  getResponseDueUrgency,
  getTypeLabel,
} from '../types/requests';

import { RequestDetailHeaderMenus } from './RequestDetailHeaderMenus';
import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestResponseDueControl } from './RequestResponseDueControl';
import { RequestStatusSelect } from './RequestStatusSelect';
import { RequestTypeSelect } from './RequestTypeSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

/** Visible plain-text budget in list quick context (same as Tasks/Notes). */
const LIST_CONTENT_PREVIEW_CHARS = 1200;

function requestStatusIcon(status: RequestStatus): LucideIcon {
  switch (status) {
    case 'in progress':
      return Clock;
    case 'completed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    default:
      return Circle;
  }
}

function truncatePlainText(
  content: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  const plain = content.trim();
  if (!plain) {
    return { text: '', truncated: false };
  }
  if (plain.length <= maxChars) {
    return { text: plain, truncated: false };
  }
  const slice = plain.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return { text: `${plain.slice(0, cut).trimEnd()}…`, truncated: true };
}

export function RequestQuickContextPanel({
  request,
  onClose,
  onOpenFullProfile,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  onResponseDueChange,
  variant = 'list',
  children = null,
}: {
  request: Request;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  onStatusChange?: (status: RequestStatus) => void;
  onPriorityChange?: (priority: RequestPriority) => void;
  onTypeChange?: (requestType: string) => void;
  onResponseDueChange?: (days: number, responseDueAt: string) => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
  /** Full detail body under the header (e.g. description in the same card). */
  children?: React.ReactNode;
}) {
  const isFullView = variant === 'full';
  const canQuickEdit =
    !isFullView &&
    Boolean(onStatusChange && onPriorityChange && onTypeChange && onResponseDueChange);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const [contentExpanded, setContentExpanded] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [showTeamQuickInfo, setShowTeamQuickInfo] = useState(false);

  useEffect(() => {
    setContentExpanded(false);
    setViewingContact(null);
    setShowTeamQuickInfo(false);
  }, [request.id]);

  const assignedContacts = useMemo(() => {
    const ids = Array.isArray(request.assignedToIds) ? request.assignedToIds : [];
    return ids
      .map((id) => contacts?.find((c: { id: string | number }) => String(c.id) === String(id)))
      .filter((contact): contact is Contact => Boolean(contact));
  }, [contacts, request.assignedToIds]);

  const linkedContact = useMemo(() => {
    if (!request.contactId) {
      return null;
    }
    return (
      contacts?.find((c: { id: string | number }) => String(c.id) === String(request.contactId)) ??
      null
    );
  }, [contacts, request.contactId]);

  const submitterPhone = linkedContact?.phone?.trim() || linkedContact?.phone2?.trim() || '';

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

  const updatedLabel = request.updated_at
    ? new Date(request.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const contentPreview = useMemo(() => {
    if (!request.description?.trim()) {
      return { text: '', truncated: false };
    }
    return truncatePlainText(request.description, LIST_CONTENT_PREVIEW_CHARS);
  }, [request.description]);

  const displayedContent = contentExpanded
    ? request.description?.trim() || ''
    : contentPreview.text;
  const showReadMoreToggle = contentPreview.truncated && !isFullView;

  const responseDueBadge = useMemo(() => {
    if (request.status === 'completed' || request.status === 'cancelled') {
      return null;
    }
    const daysLeft = getDaysUntilResponseDue(request.responseDueAt);
    if (daysLeft === null) {
      return null;
    }
    const urgency = getResponseDueUrgency(daysLeft);
    const className = RESPONSE_DUE_URGENCY_COLORS[urgency];
    if (daysLeft < 0) {
      return {
        text: t('requests.responseDue.overdue', { count: Math.abs(daysLeft) }),
        className,
      };
    }
    if (daysLeft === 0) {
      return {
        text: t('requests.responseDue.today'),
        className,
      };
    }
    if (daysLeft === 1) {
      return {
        text: t('requests.responseDue.oneDay'),
        className,
      };
    }
    return {
      text: t('requests.responseDue.daysLeft', { count: daysLeft }),
      className,
    };
  }, [request.responseDueAt, request.status, t]);

  const typeLabel = getTypeLabel(request.requestType, t);
  const statusLabel = formatRequestStatusForDisplay(request.status, t);
  const StatusIcon = requestStatusIcon(request.status);

  const titleLeading = (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <span title={statusLabel} className="inline-flex shrink-0">
          <SectionCategoryIcon
            icon={StatusIcon}
            className={cn(
              'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
              REQUEST_STATUS_ICON_SHELL_CLASS[request.status],
            )}
          />
        </span>
        <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
          {request.title || '—'}
        </h3>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span title={typeLabel} className="inline-flex shrink-0">
          <SectionCategoryIcon
            icon={Inbox}
            className={cn('h-5 w-5 [&_svg]:h-3 [&_svg]:w-3', REQUEST_TYPE_ICON_SHELL_CLASS)}
          />
        </span>
        <span className="min-w-0 truncate text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
          {typeLabel}
        </span>
      </div>
    </div>
  );

  const identityHeader = isFullView ? (
    <RequestDetailHeaderMenus request={request} leading={titleLeading} />
  ) : (
    <div className="flex min-w-0 items-start gap-3">
      <div className="min-w-0 flex-1">{titleLeading}</div>
      <QuickContextHeaderActions
        onOpen={onOpenFullProfile}
        onEdit={onEdit}
        onClose={onClose}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  const statusBadges = (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {!isFullView ? (
        <Badge
          variant="outline"
          className={cn('shrink-0', BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS.muted)}
        >
          {getTypeLabel(request.requestType, t)}
        </Badge>
      ) : null}
      <Badge className={cn('shrink-0', BADGE_CHIP_CLASS, REQUEST_STATUS_COLORS[request.status])}>
        {formatRequestStatusForDisplay(request.status, t)}
      </Badge>
      {isFullView ? (
        <>
          <Badge
            variant="outline"
            className={cn(BADGE_CHIP_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}
          >
            {request.priority}
          </Badge>
          {responseDueBadge ? (
            <Badge variant="outline" className={cn(BADGE_CHIP_CLASS, responseDueBadge.className)}>
              {responseDueBadge.text}
            </Badge>
          ) : null}
        </>
      ) : null}
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
            {statusBadges}
          </div>

          {!isFullView && displayedContent ? (
            <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere]">
              <p className="whitespace-pre-wrap text-sm text-foreground">{displayedContent}</p>
              {showReadMoreToggle ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => setContentExpanded((open) => !open)}
                >
                  {contentExpanded
                    ? t('requests.quickContext.showLess')
                    : t('requests.quickContext.readMore')}
                </button>
              ) : null}
            </div>
          ) : null}

          {isFullView && children ? (
            <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere]">
              {children}
            </div>
          ) : null}

          {!isFullView ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <User className="h-3 w-3" />
                  {t('requests.form.submitterName')}
                </div>
                <div className={DETAIL_FIELD_VALUE_CLASS}>
                  {request.submitterName?.trim() || '—'}
                </div>
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <CalendarDays className="h-3 w-3" />
                  {t('requests.view.submittedOn')}
                </div>
                <div className={DETAIL_FIELD_VALUE_CLASS}>
                  {formatSubmittedDateWithAge(request.created_at, t) ?? '—'}
                </div>
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <Mail className="h-3 w-3" />
                  {t('requests.form.submitterEmail')}
                </div>
                <ContactCopyableLink
                  value={request.submitterEmail}
                  href={mailtoHref(request.submitterEmail)}
                />
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <Phone className="h-3 w-3" />
                  {t('requests.view.phone')}
                </div>
                <ContactCopyableLink value={submitterPhone} href={telHref(submitterPhone)} />
              </div>
            </div>
          ) : null}

          {request.internalNotes?.trim() && !isFullView ? (
            <div>
              <div className="mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {t('requests.view.internalNotes')}
                </span>
              </div>
              <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                  {request.internalNotes}
                </p>
              </div>
            </div>
          ) : null}

          {canQuickEdit ? (
            <div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('requests.form.requestType')}
                </span>
                <RequestTypeSelect
                  request={request}
                  onTypeChange={onTypeChange!}
                  hideInlineLabel
                  compact
                />
              </div>
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
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('requests.responseDue.label')}
                </span>
                <RequestResponseDueControl
                  request={request}
                  onDaysChange={onResponseDueChange!}
                  hideInlineLabel
                  compact
                />
              </div>
            </div>
          ) : !isFullView ? (
            <QuickContextLinkTileGrid>
              <QuickContextLinkTile label={t('requests.form.requestType')} icon={Tag}>
                <Badge
                  variant="outline"
                  className={cn(BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS.muted)}
                >
                  {getTypeLabel(request.requestType, t)}
                </Badge>
              </QuickContextLinkTile>
              <QuickContextLinkTile label={t('requests.form.priority')} icon={Flag}>
                <Badge className={cn(BADGE_CHIP_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}>
                  {request.priority}
                </Badge>
              </QuickContextLinkTile>
            </QuickContextLinkTileGrid>
          ) : null}

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
