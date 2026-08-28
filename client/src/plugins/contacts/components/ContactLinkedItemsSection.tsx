import {
  CalendarDays,
  CheckSquare,
  FileText,
  Flag,
  Hash,
  Shirt,
  StickyNote,
  Store,
  Trophy,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { LINKED_SECTION_BADGE_CLASS } from '@/core/ui/badgeStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { formatDateTime } from '@/core/utils/dateFormat';
import { buildSlug } from '@/core/utils/slugUtils';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import {
  ESTIMATE_STATUS_COLORS,
  calculateEstimateTotals,
  formatEstimateStatusForDisplay,
} from '@/plugins/estimates/types/estimate';
import type { Estimate } from '@/plugins/estimates/types/estimate';
import { garmentsApi } from '@/plugins/garments/api/garmentsApi';
import { useGarments } from '@/plugins/garments/hooks/useGarments';
import type { GarmentList } from '@/plugins/garments/types/garments';
import type { Match } from '@/plugins/matches/types/match';
import type { Note } from '@/plugins/notes/types/notes';
import type { Slot } from '@/plugins/slots/types/slots';
import type { Task } from '@/plugins/tasks/types/tasks';
import {
  formatStatusForDisplay,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from '@/plugins/tasks/types/tasks';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { RESPONSIBLE_ROLES } from '@/plugins/teams/types/teams';
import type { Team } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';
import { listTeamAssignmentsForContact } from '@/plugins/teams/utils/teamContactUtils';

import type { Contact } from '../types/contacts';

import {
  AssignmentQuickInfoDialog,
  type AssignmentQuickInfoDetail,
} from './AssignmentQuickInfoDialog';

/** Lazy: keep MatchView/MatchQuickContextPanel out of this module's static graph. */
const MatchQuickInfoDialog = React.lazy(() =>
  import('@/plugins/matches/components/MatchQuickInfoDialog').then((m) => ({
    default: m.MatchQuickInfoDialog,
  })),
);

const BADGE_CLASS = LINKED_SECTION_BADGE_CLASS;

function formatMatchLine(match: Match): string {
  return `${match.home_team} – ${match.away_team}`;
}

function taskStatusTone(status: string): string {
  return (
    TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS] ??
    'bg-muted/40 text-muted-foreground'
  );
}

function estimateStatusTone(status: string): string {
  return (
    ESTIMATE_STATUS_COLORS[status as keyof typeof ESTIMATE_STATUS_COLORS] ??
    'bg-muted/40 text-muted-foreground'
  );
}

type LinkedTileItem = {
  key: string;
  label: string;
  meta?: string | null;
  metaClassName?: string;
  text: string;
  icon: typeof CheckSquare;
  iconClassName: string;
  onPreview: () => void;
};

type GenericLinkedPreview = {
  kind: 'generic';
  title: string;
  icon: typeof CheckSquare;
  badges?: React.ReactNode;
  details: AssignmentQuickInfoDetail[];
  openLabel: string;
  onOpen: () => void;
};

type MatchLinkedPreview = {
  kind: 'match';
  match: Match;
};

type LinkedPreview = GenericLinkedPreview | MatchLinkedPreview;

export function ContactLinkedItemsSection({
  contact,
  previewLimit = 6,
  showHeading = true,
  showHint = true,
  hideWhenEmpty = false,
}: {
  contact: Contact;
  /** Cap visible tiles; `null` shows all. */
  previewLimit?: number | null;
  showHeading?: boolean;
  /** When false, caller renders the hint beside the card title. */
  showHint?: boolean;
  /** When true, render nothing while loading or when there are no linked items. */
  hideWhenEmpty?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabledPlugins = useEnabledPlugins();
  const { teams } = useTeams();
  const { openGarmentForView } = useGarments();
  const {
    getMatchesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
    getNotesForContact,
    getSlotsForContact,
    openTaskForView,
    openNoteForView,
    openMatchForView,
    openEstimateForView,
    openSlotForView,
  } = useApp();

  const [linkedTasks, setLinkedTasks] = useState<Task[] | null>(null);
  const [linkedNotes, setLinkedNotes] = useState<Note[] | null>(null);
  const [linkedMatches, setLinkedMatches] = useState<Match[] | null>(null);
  const [linkedEstimates, setLinkedEstimates] = useState<Estimate[] | null>(null);
  const [linkedSlots, setLinkedSlots] = useState<Slot[] | null>(null);
  const [linkedGarmentLists, setLinkedGarmentLists] = useState<GarmentList[] | null>(null);
  const [preview, setPreview] = useState<LinkedPreview | null>(null);

  const hasTasksPlugin = enabledPlugins.has('tasks');
  const hasNotesPlugin = enabledPlugins.has('notes');
  const hasMatchesPlugin = enabledPlugins.has('matches');
  const hasEstimatesPlugin = enabledPlugins.has('estimates');
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const hasSlotsPlugin = enabledPlugins.has('slots');
  const hasGarmentsPlugin = enabledPlugins.has('garments');
  const showLinkedSection =
    hasTasksPlugin ||
    hasNotesPlugin ||
    hasMatchesPlugin ||
    hasEstimatesPlugin ||
    hasTeamsPlugin ||
    hasSlotsPlugin ||
    hasGarmentsPlugin;

  const teamAssignments = useMemo(() => {
    if (!hasTeamsPlugin || !contact?.id) {
      return [];
    }
    return listTeamAssignmentsForContact(teams, contact.id);
  }, [hasTeamsPlugin, contact?.id, teams]);

  useEffect(() => {
    let cancelled = false;
    if (!contact?.id || !showLinkedSection) {
      setLinkedTasks(null);
      setLinkedNotes(null);
      setLinkedMatches(null);
      setLinkedEstimates(null);
      setLinkedSlots(null);
      setLinkedGarmentLists(null);
      return;
    }

    const contactId = String(contact.id);

    void (async () => {
      const [tasksAssigned, tasksMentioned, notes, matches, estimates, slots, garmentLists] =
        await Promise.all([
          hasTasksPlugin && getTasksForContact
            ? getTasksForContact(contactId)
            : Promise.resolve([] as Task[]),
          hasTasksPlugin && getTasksWithMentionsForContact
            ? getTasksWithMentionsForContact(contactId)
            : Promise.resolve([] as Task[]),
          hasNotesPlugin && getNotesForContact
            ? getNotesForContact(contactId)
            : Promise.resolve([] as Note[]),
          hasMatchesPlugin && getMatchesForContact
            ? getMatchesForContact(contactId)
            : Promise.resolve([] as Match[]),
          hasEstimatesPlugin && getEstimatesForContact
            ? getEstimatesForContact(contactId)
            : Promise.resolve([] as Estimate[]),
          hasSlotsPlugin && getSlotsForContact
            ? getSlotsForContact(contactId)
            : Promise.resolve([] as Slot[]),
          hasGarmentsPlugin
            ? garmentsApi.getListsForContact(contactId).catch(() => [] as GarmentList[])
            : Promise.resolve([] as GarmentList[]),
        ]);

      if (cancelled) {
        return;
      }

      const taskMap = new Map<string, Task>();
      for (const task of [...tasksAssigned, ...tasksMentioned]) {
        taskMap.set(String(task.id), task);
      }
      setLinkedTasks(Array.from(taskMap.values()));
      setLinkedNotes(notes);
      setLinkedMatches(matches);
      setLinkedEstimates(estimates);
      setLinkedSlots(slots);
      setLinkedGarmentLists(garmentLists);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    contact?.id,
    showLinkedSection,
    hasTasksPlugin,
    hasNotesPlugin,
    hasMatchesPlugin,
    hasEstimatesPlugin,
    hasSlotsPlugin,
    hasGarmentsPlugin,
    getNotesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
    getMatchesForContact,
    getEstimatesForContact,
    getSlotsForContact,
  ]);

  useEffect(() => {
    setPreview(null);
  }, [contact?.id]);

  const openTeam = (team: Team) => {
    setPreview(null);
    navigate(`/teams/${buildSlug(team, teams, 'name')}`);
  };

  const linkedItems = useMemo((): LinkedTileItem[] => {
    const items: LinkedTileItem[] = [];

    for (const task of linkedTasks ?? []) {
      items.push({
        key: `task-${task.id}`,
        label: t('nav.task'),
        meta: formatStatusForDisplay(task.status),
        metaClassName: taskStatusTone(task.status),
        text: task.title,
        icon: CheckSquare,
        iconClassName: 'text-violet-600',
        onPreview: () => {
          const details: AssignmentQuickInfoDetail[] = [
            {
              icon: Flag,
              label: t('tasks.propertyStatus'),
              value: formatStatusForDisplay(task.status),
            },
            {
              icon: Flag,
              label: t('tasks.propertyPriority'),
              value: task.priority,
            },
          ];
          if (task.dueDate) {
            details.push({
              icon: CalendarDays,
              label: t('tasks.propertyDueDate'),
              value: new Date(task.dueDate).toLocaleDateString(),
            });
          }
          const plainContent = htmlToPlainTextWithBreaks(task.content || '').trim();
          if (plainContent) {
            const preview =
              plainContent.length > 200 ? `${plainContent.slice(0, 200).trimEnd()}…` : plainContent;
            details.push({
              icon: CheckSquare,
              label: t('tasks.taskContent'),
              value: preview,
            });
          }
          setPreview({
            kind: 'generic',
            title: task.title || '—',
            icon: CheckSquare,
            badges: (
              <>
                <span className={cn(taskStatusTone(task.status), BADGE_CLASS)}>
                  {formatStatusForDisplay(task.status)}
                </span>
                <span
                  className={cn(
                    TASK_PRIORITY_COLORS[task.priority as keyof typeof TASK_PRIORITY_COLORS],
                    BADGE_CLASS,
                  )}
                >
                  {task.priority}
                </span>
              </>
            ),
            details,
            openLabel: t('contacts.openTask'),
            onOpen: () => {
              setPreview(null);
              openTaskForView?.(task);
            },
          });
        },
      });
    }

    for (const note of linkedNotes ?? []) {
      items.push({
        key: `note-${note.id}`,
        label: t('nav.note'),
        text: note.title,
        icon: StickyNote,
        iconClassName: 'text-amber-600',
        onPreview: () => {
          const details: AssignmentQuickInfoDetail[] = [];
          if (note.updatedAt) {
            details.push({
              icon: CalendarDays,
              label: t('common.updated'),
              value: new Date(note.updatedAt).toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            });
          }
          const plainContent = htmlToPlainTextWithBreaks(note.content || '').trim();
          if (plainContent) {
            const preview =
              plainContent.length > 200 ? `${plainContent.slice(0, 200).trimEnd()}…` : plainContent;
            details.push({
              icon: StickyNote,
              label: t('notes.content'),
              value: preview,
            });
          }
          setPreview({
            kind: 'generic',
            title: note.title || '—',
            icon: StickyNote,
            details,
            openLabel: t('contacts.openNote'),
            onOpen: () => {
              setPreview(null);
              openNoteForView?.(note);
            },
          });
        },
      });
    }

    for (const { team, responsible } of teamAssignments) {
      const roleKey = RESPONSIBLE_ROLES.includes(
        responsible.role as (typeof RESPONSIBLE_ROLES)[number],
      )
        ? responsible.role
        : 'other';
      const roleLabel = t(`teams.roles.${roleKey}`);
      const teamTitle = formatTeamLabel(team) || team.name || '—';
      items.push({
        key: `team-${team.id}-${responsible.role}-${responsible.seriesTeam ?? ''}`,
        label: t('nav.team'),
        meta: roleLabel,
        metaClassName:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        text: teamTitle,
        icon: Users,
        iconClassName: 'text-emerald-600',
        onPreview: () => {
          setPreview({
            kind: 'generic',
            title: teamTitle,
            icon: Users,
            badges: (
              <span
                className={cn(
                  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                  BADGE_CLASS,
                )}
              >
                {roleLabel}
              </span>
            ),
            details: [
              {
                icon: Users,
                label: t('teams.form.roleLabel'),
                value: roleLabel,
              },
            ],
            openLabel: t('contacts.openTeam'),
            onOpen: () => openTeam(team),
          });
        },
      });
    }

    for (const match of linkedMatches ?? []) {
      items.push({
        key: `match-${match.id}`,
        label: t('nav.match'),
        text: formatMatchLine(match),
        icon: Trophy,
        iconClassName: 'text-amber-600',
        onPreview: () => setPreview({ kind: 'match', match }),
      });
    }

    for (const slot of linkedSlots ?? []) {
      const when = slot.slot_time ? formatDateTime(slot.slot_time) : null;
      const slotTitle =
        (slot.name && String(slot.name).trim()) || slot.location || t('contacts.relatedSlots');
      items.push({
        key: `slot-${slot.id}`,
        label: t('nav.slots'),
        meta: when,
        metaClassName: 'bg-muted/40 text-muted-foreground',
        text: slotTitle,
        icon: Store,
        iconClassName: 'text-indigo-600',
        onPreview: () => {
          const details: AssignmentQuickInfoDetail[] = [];
          if (when) {
            details.push({
              icon: CalendarDays,
              label: t('matches.dateLabel'),
              value: when,
            });
          }
          if (slot.location?.trim()) {
            details.push({
              icon: Store,
              label: t('slots.locationLabel'),
              value: slot.location,
            });
          }
          setPreview({
            kind: 'generic',
            title: slotTitle,
            icon: Store,
            details,
            openLabel: t('contacts.openSlot'),
            onOpen: () => {
              setPreview(null);
              openSlotForView?.(slot);
            },
          });
        },
      });
    }

    for (const estimate of linkedEstimates ?? []) {
      const estimateTitle = estimate.estimateNumber || estimate.contactName || '—';
      items.push({
        key: `estimate-${estimate.id}`,
        label: t('nav.estimate'),
        meta: formatEstimateStatusForDisplay(estimate.status),
        metaClassName: estimateStatusTone(estimate.status),
        text: estimateTitle,
        icon: FileText,
        iconClassName: 'text-sky-600',
        onPreview: () => {
          const lineItems = Array.isArray(estimate.lineItems) ? estimate.lineItems : [];
          const totals = calculateEstimateTotals(lineItems, estimate.estimateDiscount || 0);
          const currency = estimate.currency || 'SEK';
          const formatAmount = (amount: number) => `${amount.toFixed(2)} ${currency}`;
          setPreview({
            kind: 'generic',
            title: estimateTitle,
            icon: FileText,
            badges: (
              <span className={cn(estimateStatusTone(estimate.status), BADGE_CLASS)}>
                {formatEstimateStatusForDisplay(estimate.status)}
              </span>
            ),
            details: [
              {
                icon: FileText,
                label: t('estimates.fieldStatus'),
                value: formatEstimateStatusForDisplay(estimate.status),
              },
              {
                icon: Hash,
                label: t('estimates.quickInfo.items'),
                value: t('estimates.quickInfo.itemsCount', { count: lineItems.length }),
              },
              {
                icon: FileText,
                label: t('estimates.quickInfo.amountExclTax'),
                value: formatAmount(totals.subtotalAfterEstimateDiscount),
              },
              {
                icon: FileText,
                label: t('estimates.quickInfo.amountInclTax'),
                value: formatAmount(totals.total),
              },
            ],
            openLabel: t('contacts.openEstimate'),
            onOpen: () => {
              setPreview(null);
              openEstimateForView?.(estimate);
            },
          });
        },
      });
    }

    for (const list of linkedGarmentLists ?? []) {
      const listTitle = list.name?.trim() || t('garments.list');
      items.push({
        key: `garment-list-${list.id}`,
        label: t('nav.garments'),
        meta:
          list.personCount != null
            ? t('garments.personCount', { count: list.personCount })
            : undefined,
        metaClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
        text: listTitle,
        icon: Shirt,
        iconClassName: 'text-rose-600',
        onPreview: () => {
          setPreview({
            kind: 'generic',
            title: listTitle,
            icon: Shirt,
            details:
              list.personCount != null
                ? [
                    {
                      icon: Users,
                      label: t('garments.persons'),
                      value: t('garments.personCount', { count: list.personCount }),
                    },
                  ]
                : [],
            openLabel: t('contacts.openGarmentList'),
            onOpen: () => {
              setPreview(null);
              openGarmentForView(list);
            },
          });
        },
      });
    }

    return items;
  }, [
    linkedTasks,
    linkedNotes,
    teamAssignments,
    linkedMatches,
    linkedSlots,
    linkedEstimates,
    linkedGarmentLists,
    openTaskForView,
    openNoteForView,
    openMatchForView,
    openSlotForView,
    openEstimateForView,
    openGarmentForView,
    teams,
    t,
  ]);

  if (!showLinkedSection) {
    return null;
  }

  const isLinkedLoading =
    (hasTasksPlugin && linkedTasks === null) ||
    (hasNotesPlugin && linkedNotes === null) ||
    (hasMatchesPlugin && linkedMatches === null) ||
    (hasEstimatesPlugin && linkedEstimates === null) ||
    (hasSlotsPlugin && linkedSlots === null) ||
    (hasGarmentsPlugin && linkedGarmentLists === null);

  if (hideWhenEmpty && (isLinkedLoading || linkedItems.length === 0)) {
    return null;
  }

  const visibleItems = previewLimit == null ? linkedItems : linkedItems.slice(0, previewLimit);
  const hiddenLinkedCount =
    previewLimit == null ? 0 : Math.max(0, linkedItems.length - previewLimit);

  const genericPreview = preview?.kind === 'generic' ? preview : null;
  const matchPreview = preview?.kind === 'match' ? preview.match : null;

  return (
    <>
      <div>
        {showHeading ? (
          <div className="mb-1.5 flex items-baseline gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {t('contacts.quickContext.linked')}
            </p>
            {showHint ? (
              <p className="text-xs text-muted-foreground">
                {t('contacts.quickContext.linkedHint')}
              </p>
            ) : null}
          </div>
        ) : null}
        {isLinkedLoading ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : linkedItems.length > 0 ? (
          <>
            <QuickContextLinkTileGrid>
              {visibleItems.map((item) => (
                <QuickContextLinkTile
                  key={item.key}
                  label={item.label}
                  meta={item.meta}
                  metaClassName={item.metaClassName}
                  icon={item.icon}
                  iconClassName={item.iconClassName}
                  onClick={item.onPreview}
                >
                  {item.text}
                </QuickContextLinkTile>
              ))}
            </QuickContextLinkTileGrid>
            {hiddenLinkedCount > 0 ? (
              <p className="pt-1.5 text-center text-xs text-muted-foreground">
                {t('contacts.quickContext.moreLinked', { count: hiddenLinkedCount })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('contacts.quickContext.noLinked')}</p>
        )}
      </div>

      <AssignmentQuickInfoDialog
        isOpen={genericPreview !== null}
        title={genericPreview?.title ?? ''}
        icon={genericPreview?.icon ?? CheckSquare}
        badges={genericPreview?.badges}
        details={genericPreview?.details ?? []}
        openLabel={genericPreview?.openLabel ?? t('common.open')}
        onClose={() => setPreview(null)}
        onOpen={() => genericPreview?.onOpen()}
      />

      {matchPreview !== null ? (
        <React.Suspense fallback={null}>
          <MatchQuickInfoDialog
            isOpen
            match={matchPreview}
            onClose={() => setPreview(null)}
            onOpenMatch={() => {
              openMatchForView?.(matchPreview);
              setPreview(null);
            }}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
