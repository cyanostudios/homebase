import {
  CalendarDays,
  CheckSquare,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Info,
  Mail,
  MapPin,
  Phone,
  SlidersHorizontal,
  StickyNote,
  Store,
  Tag,
  Trash2,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, type DetailSectionIconPlugin } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_LABEL_CLASS as FIELD_LABEL_CLASS,
  DETAIL_FIELD_LABEL_ICON_CLASS as FIELD_LABEL_ICON_CLASS,
  DETAIL_FIELD_VALUE_CLASS as FIELD_VALUE_CLASS,
  DETAIL_INFO_ROW_CLASS as INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS as NOTE_CLASS,
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS as SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS as CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDateTime } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import {
  ESTIMATE_STATUS_COLORS,
  formatEstimateStatusForDisplay,
} from '@/plugins/estimates/types/estimate';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { useSlotsContext } from '@/plugins/slots/context/SlotsContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { formatStatusForDisplay } from '@/plugins/tasks/types/tasks';
import { SeriesTeamBadge } from '@/plugins/teams/components/ResponsibleRow';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import {
  getSeriesTeamColorForName,
  getSeriesTeamDisplayLabel,
  RESPONSIBLE_ROLE_BADGES,
  RESPONSIBLE_ROLES,
  responsibleKey,
} from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';
import { listTeamAssignmentsForContact } from '@/plugins/teams/utils/teamContactUtils';
import { useNavigate } from 'react-router-dom';

import {
  AssignmentQuickInfoDialog,
  type AssignmentQuickInfoDetail,
} from './AssignmentQuickInfoDialog';
import { ContactAssignmentRow } from './ContactAssignmentRow';
import { ContactCopyableLink, mailtoHref, telHref, websiteHref } from './ContactCopyableLink';
import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  formatCompanyTypeLabel,
} from '../types/contacts';
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';

type ViewingAssignment = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badges: React.ReactNode;
  details: AssignmentQuickInfoDetail[];
  openLabel: string;
  onOpen: () => void;
};

interface ContactViewProps {
  contact: Contact;
}

type RelatedItem = {
  id: string | number;
  label: string;
  onOpen: () => void;
  pluginClass: string;
};

function ContactQuickActionsCard({
  contact,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
}: {
  contact: any;
  onEdit: (contact: any) => void;
  onDeleteClick: () => void;
  onDuplicate: (contact: any) => void;
  getDuplicateConfig: (
    item: any | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: any) => void;
    className?: string;
    disabled?: boolean;
  }>;
}) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(contact));
  const actionRowClass = DETAIL_QUICK_ACTION_ROW_CLASS;

  const getActionIconColorClass = (actionId: string): string => {
    if (actionId === 'send-message') {
      return 'text-violet-600 dark:text-violet-400';
    }
    if (actionId === 'send-email') {
      return 'text-red-600 dark:text-red-400';
    }
    return '';
  };

  return (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection
        title={t('contacts.quickActions')}
        icon={Zap}
        iconPlugin="contacts"
        subtleTitle
        className="p-4"
      >
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
            onClick={() => onEdit(contact)}
          >
            {t('contacts.edit')}
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
            {t('contacts.delete')}
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
              onClick={() => onDuplicate(contact)}
            >
              {t('contacts.duplicate')}
            </Button>
          )}
          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={(props) => (
                    <Icon
                      {...props}
                      className={cn(props.className, getActionIconColorClass(action.id))}
                    />
                  )}
                  disabled={action.disabled}
                  className={cn(actionRowClass, 'disabled:opacity-50', action.className)}
                  onClick={() => action.onClick(contact)}
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

function ContactExportOptionsCard({
  contact,
  exportFormats,
  onExportItem,
}: {
  contact: any;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: any) => void;
}) {
  const { t } = useTranslation();
  if (!Array.isArray(exportFormats) || exportFormats.length === 0) {
    return null;
  }
  const actionRowClass = DETAIL_QUICK_ACTION_ROW_CLASS;
  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('contacts.exportTxt'),
    csv: t('contacts.exportCsv'),
    pdf: t('contacts.exportPdf'),
  };

  return (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection
        title={t('contacts.exportOptions')}
        icon={Download}
        iconPlugin="contacts"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={actionRowClass}
              onClick={() => onExportItem(format, contact)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
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
  iconPlugin: DetailSectionIconPlugin;
  items: RelatedItem[];
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return null;
  }

  return (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection title={title} icon={Icon} iconPlugin={iconPlugin} subtleTitle className="p-4">
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={`${title}-${item.id}`} className={cn(SURFACE_ROW_CLASS, item.pluginClass)}>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {item.label}
              </span>
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

function ContactAssignmentsCard({
  title,
  icon: Icon,
  iconPlugin,
  children,
  isEmpty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconPlugin: DetailSectionIconPlugin;
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return null;
  }

  return (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection title={title} icon={Icon} iconPlugin={iconPlugin} subtleTitle className="p-4">
        <div className={cn('space-y-2', `plugin-${iconPlugin}`)}>{children}</div>
      </DetailSection>
    </Card>
  );
}

function formatAssignmentDueDate(
  dueDate: Date | string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): { label: string; className: string } | null {
  if (!dueDate) {
    return null;
  }
  const due = new Date(dueDate);
  if (!Number.isFinite(due.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: t('contacts.assignmentDueOverdue', { count: Math.abs(diffDays) }),
      className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    };
  }
  if (diffDays === 0) {
    return {
      label: t('contacts.assignmentDueToday'),
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    };
  }
  if (diffDays === 1) {
    return {
      label: t('contacts.assignmentDueTomorrow'),
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    };
  }
  return {
    label: t('contacts.assignmentDueOn', { date: due.toLocaleDateString() }),
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
}

export const ContactView = React.memo(function ContactView({ contact }: ContactViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabledPlugins = useEnabledPlugins();
  const { teams } = useTeams();
  const { tasks } = useTasks();
  const { estimates } = useEstimates();
  const { slots: allSlots } = useSlotsContext();
  const {
    getSettings,
    settingsVersion,
    getNotesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getSlotsForContact,
    getMatchesForContact,
    openMatchForView,
  } = useApp();

  const {
    closeContactPanel,
    openContactForEdit,
    deleteContact,
    getDeleteMessage,
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    closeSendEmailDialog,
    detailFooterActions,
    exportFormats,
    onExportItem,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedContactId,
    setContactHasTimeEntries,
    displayTags,
    addTagToDraft,
    removeTagFromDraft,
    tagError,
    showDiscardTagsDialog,
    setShowDiscardTagsDialog,
    onDiscardTagsAndClose,
  } = useContacts();

  const [mentionedInNotes, setMentionedInNotes] = useState<any[]>([]);
  const [relatedEstimates, setRelatedEstimates] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [matchMatches, setMatchMatches] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<
    { id: string; seconds: number; loggedAt: string }[]
  >([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  const [showDeleteContactConfirm, setShowDeleteContactConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<ViewingAssignment | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const settings = await getSettings(CONTACTS_SETTINGS_KEY);
        if (cancelled) {
          return;
        }
        const list = Array.isArray(settings?.tags) ? settings.tags : [];
        setAvailableTags(
          list
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim())
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) {
          setAvailableTags([]);
        }
      }
    };
    void loadTags();
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const addableTags = useMemo(
    () =>
      availableTags.filter(
        (item) =>
          !displayTags.some((tag) => String(tag).toLowerCase() === String(item).toLowerCase()),
      ),
    [availableTags, displayTags],
  );

  useEffect(() => {
    if (!contact?.id) {
      setTimeEntries([]);
      return;
    }
    const contactId = contact.id;
    const loadTimeEntries = async () => {
      try {
        const response = await apiFetch(`/api/contacts/${contactId}/time-entries`);
        if (!response.ok) {
          setTimeEntries([]);
          return;
        }
        const data = await response.json();
        setTimeEntries(Array.isArray(data) ? data : []);
      } catch {
        setTimeEntries([]);
      }
    };
    loadTimeEntries();
  }, [contact?.id]);

  useEffect(() => {
    if (!contact?.id) {
      return;
    }
    setContactHasTimeEntries(contact.id, timeEntries.length > 0);
  }, [contact?.id, timeEntries.length, setContactHasTimeEntries]);

  useEffect(() => {
    if (!contact?.id) {
      return;
    }

    void getNotesForContact(contact.id)
      .then(setMentionedInNotes)
      .catch(() => setMentionedInNotes([]));
    void getEstimatesForContact(contact.id)
      .then(setRelatedEstimates)
      .catch(() => setRelatedEstimates([]));
    void getTasksForContact(contact.id)
      .then(setAssignedTasks)
      .catch(() => setAssignedTasks([]));
    void getSlotsForContact(contact.id)
      .then(setSlots)
      .catch(() => setSlots([]));
    void getMatchesForContact(contact.id)
      .then(setMatchMatches)
      .catch(() => setMatchMatches([]));
  }, [
    contact?.id,
    getEstimatesForContact,
    getMatchesForContact,
    getNotesForContact,
    getSlotsForContact,
    getTasksForContact,
  ]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  }, []);

  const handleDeleteTimeEntry = useCallback(
    async (entryId: string) => {
      if (!contact?.id) {
        return;
      }
      setDeletingEntryId(entryId);
      try {
        const response = await apiFetch(`/api/contacts/${contact.id}/time-entries/${entryId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setTimeEntries((prev) => prev.filter((entry) => entry.id !== entryId));
        }
      } finally {
        setDeletingEntryId(null);
      }
    },
    [contact?.id],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!contact) {
      return;
    }
    await deleteContact(contact.id);
    setShowDeleteContactConfirm(false);
    closeContactPanel();
  }, [contact, deleteContact, closeContactPanel]);

  const teamAssignments = useMemo(() => {
    if (!enabledPlugins.has('teams') || !contact?.id) {
      return [];
    }
    return listTeamAssignmentsForContact(teams, contact.id);
  }, [enabledPlugins, contact?.id, teams]);

  const toMatchItems: RelatedItem[] = useMemo(
    () =>
      matchMatches.map((item: any) => ({
        id: item.id,
        label: `${item.home_team ?? '—'} - ${item.away_team ?? '—'}`,
        onOpen: () => {
          closeContactPanel();
          openMatchForView?.(item);
        },
        pluginClass: 'plugin-matches bg-plugin-subtle/40',
      })),
    [matchMatches, closeContactPanel, openMatchForView],
  );

  if (!contact) {
    return null;
  }
  const duplicateConfig = getDuplicateConfig(contact);

  const isCompany = contact.contactType === 'company';
  const contactIdLabel = formatDisplayNumber('contacts', contact.id);

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <ContactQuickActionsCard
              contact={contact}
              onEdit={openContactForEdit}
              onDeleteClick={() => setShowDeleteContactConfirm(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
              detailFooterActions={detailFooterActions}
            />
            <ContactExportOptionsCard
              contact={contact}
              exportFormats={exportFormats}
              onExportItem={onExportItem}
            />

            {/* Time log card */}
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection title="Time log" icon={Clock} subtleTitle className="p-4">
                {timeEntries.length === 0 ? (
                  <div className={EMPTY_STATE_CLASS}>
                    <Clock className="mx-auto h-5 w-5 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No time entries</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {timeEntries.map((entry) => (
                      <div key={entry.id} className={SURFACE_ROW_CLASS}>
                        <span className="text-xs text-foreground">
                          {formatDuration(entry.seconds)} -{' '}
                          {new Date(entry.loggedAt).toLocaleDateString()}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={() => setConfirmDeleteEntryId(entry.id)}
                          disabled={deletingEntryId === entry.id}
                        >
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            </Card>

            {/* Information card — divider-row pattern */}
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection
                title={t('contacts.information')}
                icon={Info}
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {contactIdLabel}
                    </span>
                  </div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(contact.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="contact"
              entityId={contact.id}
              limit={30}
              title={t('contacts.activity')}
              showClearButton
              refreshKey={String(contact.updatedAt ?? contact.id)}
            />
          </div>
        }
      >
        <div className="space-y-4">
          {/* Contact Content card */}
          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={t('contacts.contactContent')}
              icon={User}
              iconPlugin="contacts"
              subtleTitle
              className="p-6"
            >
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <div className={FIELD_LABEL_CLASS}>
                    <User className={FIELD_LABEL_ICON_CLASS} />
                    Name
                  </div>
                  <div className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                    {contact.companyName || '—'}
                  </div>
                </div>

                {/* 2-column field grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <div className={FIELD_LABEL_CLASS}>Contact #</div>
                    <div className={FIELD_VALUE_CLASS}>{contact.contactNumber || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>Type</div>
                    <div>
                      <Badge
                        className={cn(
                          CONTACT_TYPE_BADGE_CLASS,
                          CONTACT_TYPE_COLORS[contact.contactType],
                        )}
                      >
                        {isCompany ? 'Company' : 'Private'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      {isCompany
                        ? t('contacts.quickInfo.organizationNumber')
                        : t('contacts.quickInfo.personalNumber')}
                    </div>
                    <div className={FIELD_VALUE_CLASS}>
                      {(isCompany ? contact.organizationNumber : contact.personalNumber) || '—'}
                    </div>
                  </div>
                  {isCompany ? (
                    <div>
                      <div className={FIELD_LABEL_CLASS}>VAT Number</div>
                      <div className={FIELD_VALUE_CLASS}>{contact.vatNumber || '—'}</div>
                    </div>
                  ) : null}
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Mail className={FIELD_LABEL_ICON_CLASS} />
                      Email
                    </div>
                    <ContactCopyableLink value={contact.email} href={mailtoHref(contact.email)} />
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Globe className={FIELD_LABEL_ICON_CLASS} />
                      Website
                    </div>
                    <ContactCopyableLink
                      value={contact.website}
                      href={websiteHref(contact.website)}
                      openInNewTab
                    />
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Phone className={FIELD_LABEL_ICON_CLASS} />
                      Phone 1
                    </div>
                    <ContactCopyableLink value={contact.phone} href={telHref(contact.phone)} />
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Phone className={FIELD_LABEL_ICON_CLASS} />
                      Phone 2
                    </div>
                    <ContactCopyableLink value={contact.phone2} href={telHref(contact.phone2)} />
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          {contact.notes?.trim() ? (
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection
                title={t('contacts.relatedNotes')}
                icon={StickyNote}
                subtleTitle
                className="p-6"
              >
                <div className={NOTE_CLASS}>
                  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                    {contact.notes}
                  </p>
                </div>
              </DetailSection>
            </Card>
          ) : null}

          {/* Contact Properties — divider list with colored pills */}
          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={t('contacts.contactProperties')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-6"
            >
              <div>
                {isCompany ? (
                  <div className={PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Company type</span>
                    <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                      {formatCompanyTypeLabel(contact.companyType)}
                    </Badge>
                  </div>
                ) : null}
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Tax rate</span>
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {isCompany ? (contact.taxRate ? `${contact.taxRate}%` : '—') : '0%'}
                  </Badge>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Payment terms</span>
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {contact.paymentTerms ? `${contact.paymentTerms} days` : '—'}
                  </Badge>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Currency</span>
                  <Badge className="border-0 rounded-md bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/40 dark:text-indigo-300">
                    {contact.currency || '—'}
                  </Badge>
                </div>
                {isCompany ? (
                  <div className={PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">F-tax</span>
                    {contact.fTax === 'yes' ? (
                      <Badge className="border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300">
                        Registered
                      </Badge>
                    ) : (
                      <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                        No
                      </Badge>
                    )}
                  </div>
                ) : null}
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Assignable</span>
                  {contact.isAssignable ? (
                    <Badge className="border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300">
                      Yes
                    </Badge>
                  ) : (
                    <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                      No
                    </Badge>
                  )}
                </div>
                {/* Tags row — draft edit; header Update calls onApplyTagsEdit */}
                <div className="pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className={FIELD_LABEL_CLASS}>Tags</div>
                    <Select
                      value={tagToAdd || '__add_tag__'}
                      onValueChange={(value) => {
                        if (value && value !== '__add_tag__') {
                          addTagToDraft(value);
                          setTagToAdd('');
                        }
                      }}
                      disabled={addableTags.length === 0}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Add a tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__add_tag__">
                          {addableTags.length === 0 ? 'No more tags to add' : 'Add a tag...'}
                        </SelectItem>
                        {addableTags.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {tagError ? <p className="mt-1 text-xs text-destructive">{tagError}</p> : null}
                  {displayTags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {displayTags.map((item: string) => (
                        <Badge
                          key={item}
                          className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Tag className="h-3 w-3" />
                          {item}
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-muted"
                            onClick={() => removeTagFromDraft(item)}
                            aria-label={`Remove tag ${item}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="mt-1 block text-xs text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
            </DetailSection>
          </Card>

          {/* Addresses card */}
          {Array.isArray(contact.addresses) && contact.addresses.length > 0 && (
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection title="Addresses" icon={MapPin} subtleTitle className="p-6">
                <div className="space-y-6">
                  {contact.addresses.map((address: any, idx: number) => (
                    <div
                      key={address.id}
                      className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                    >
                      {/* Address type as badge pill */}
                      <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                        {address.type || 'Address'}
                      </Badge>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {address.addressLine1 && (
                          <div className="col-span-2">
                            <div className={FIELD_LABEL_CLASS}>Address</div>
                            <div className={FIELD_VALUE_CLASS}>
                              {[address.addressLine1, address.addressLine2]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                        {(address.postalCode || address.city) && (
                          <div>
                            <div className={FIELD_LABEL_CLASS}>Postal Code / City</div>
                            <div className={FIELD_VALUE_CLASS}>
                              {[address.postalCode, address.city].filter(Boolean).join(' ')}
                            </div>
                          </div>
                        )}
                        {address.region && (
                          <div>
                            <div className={FIELD_LABEL_CLASS}>Region</div>
                            <div className={FIELD_VALUE_CLASS}>{address.region}</div>
                          </div>
                        )}
                        {address.country && (
                          <div>
                            <div className={FIELD_LABEL_CLASS}>Country</div>
                            <div className={FIELD_VALUE_CLASS}>{address.country}</div>
                          </div>
                        )}
                        {address.email && (
                          <div>
                            <div className={FIELD_LABEL_CLASS}>Email</div>
                            <ContactCopyableLink
                              value={address.email}
                              href={mailtoHref(address.email)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          {/* Contact Persons card */}
          {Array.isArray(contact.contactPersons) && contact.contactPersons.length > 0 && (
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection title="Contact Persons" icon={Users} subtleTitle className="p-6">
                <div className="space-y-6">
                  {contact.contactPersons.map((person: any, idx: number) => {
                    const personInitials = (person.name || '')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n: string) => n[0].toUpperCase())
                      .join('');
                    return (
                      <div
                        key={person.id}
                        className={cn(
                          'flex items-start gap-4',
                          idx > 0 && 'border-t border-border/50 pt-6',
                        )}
                      >
                        {/* Avatar bubble */}
                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 dark:from-slate-700 dark:to-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-semibold shrink-0">
                          {personInitials || <User className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                            {person.name || '—'}
                          </div>
                          {person.title && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {person.title}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-4">
                            {person.email && (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Email</div>
                                <ContactCopyableLink
                                  value={person.email}
                                  href={mailtoHref(person.email)}
                                />
                              </div>
                            )}
                            {person.phone && (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Phone</div>
                                <ContactCopyableLink
                                  value={person.phone}
                                  href={telHref(person.phone)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            </Card>
          )}

          {/* Related plugin cards — sidebar nav order (Main → Sport → Booking → Business) */}
          {enabledPlugins.has('notes') ? (
            <ContactAssignmentsCard
              title={t('contacts.relatedNotes')}
              icon={StickyNote}
              iconPlugin="notes"
              isEmpty={mentionedInNotes.length === 0}
            >
              {mentionedInNotes.map((item: any) => {
                const title = item.title || 'Note';
                const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
                const updatedLabel =
                  updatedAt && Number.isFinite(updatedAt.getTime())
                    ? updatedAt.toLocaleDateString()
                    : null;
                const rowBadges = updatedLabel
                  ? [
                      {
                        label: updatedLabel,
                        className:
                          'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                      },
                    ]
                  : [];
                const openNote = () => {
                  closeContactPanel();
                  setViewingAssignment(null);
                  navigate(`/notes/${buildSlug(item, mentionedInNotes, 'title')}`);
                };
                const details: AssignmentQuickInfoDetail[] = [];
                if (updatedLabel) {
                  details.push({
                    icon: CalendarDays,
                    label: t('common.updated'),
                    value: updatedLabel,
                  });
                }
                return (
                  <ContactAssignmentRow
                    key={item.id}
                    title={title}
                    badges={rowBadges}
                    actionLabel={t('contacts.openNote')}
                    pluginClass="plugin-notes"
                    onTitleClick={() => {
                      setViewingAssignment({
                        title,
                        icon: StickyNote,
                        badges: rowBadges.map((badge) => (
                          <span
                            key={`${badge.label}-${badge.className ?? ''}`}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        )),
                        details,
                        openLabel: t('contacts.openNote'),
                        onOpen: openNote,
                      });
                    }}
                    onOpen={openNote}
                  />
                );
              })}
            </ContactAssignmentsCard>
          ) : null}
          {enabledPlugins.has('tasks') ? (
            <ContactAssignmentsCard
              title={t('contacts.relatedTasks')}
              icon={CheckSquare}
              iconPlugin="tasks"
              isEmpty={assignedTasks.length === 0}
            >
              {assignedTasks.map((item: any) => {
                const due =
                  item.dueDate && item.status !== 'completed'
                    ? formatAssignmentDueDate(item.dueDate, t)
                    : null;
                const statusLabel = item.status
                  ? formatStatusForDisplay(String(item.status))
                  : null;
                const title = item.title || 'Task';
                const rowBadges = [
                  ...(statusLabel
                    ? [
                        {
                          label: statusLabel,
                          className:
                            'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
                        },
                      ]
                    : []),
                  ...(due ? [{ label: due.label, className: due.className }] : []),
                  ...(item.priority
                    ? [
                        {
                          label: String(item.priority),
                          className:
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                        },
                      ]
                    : []),
                ];
                const openTask = () => {
                  closeContactPanel();
                  setViewingAssignment(null);
                  navigate(`/tasks/${buildSlug(item, tasks, 'title')}`);
                };
                const details: AssignmentQuickInfoDetail[] = [];
                if (statusLabel) {
                  details.push({
                    icon: CheckSquare,
                    label: t('tasks.propertyStatus'),
                    value: statusLabel,
                  });
                }
                if (item.priority) {
                  details.push({
                    icon: Flag,
                    label: t('tasks.propertyPriority'),
                    value: String(item.priority),
                  });
                }
                if (item.dueDate) {
                  const dueDate = new Date(item.dueDate);
                  if (Number.isFinite(dueDate.getTime())) {
                    details.push({
                      icon: CalendarDays,
                      label: t('tasks.propertyDueDate'),
                      value: dueDate.toLocaleDateString(),
                    });
                  }
                }
                return (
                  <ContactAssignmentRow
                    key={item.id}
                    title={title}
                    badges={rowBadges}
                    actionLabel={t('contacts.openTask')}
                    pluginClass="plugin-tasks"
                    onTitleClick={() => {
                      setViewingAssignment({
                        title,
                        icon: CheckSquare,
                        badges: rowBadges.map((badge) => (
                          <span
                            key={`${badge.label}-${badge.className ?? ''}`}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        )),
                        details,
                        openLabel: t('contacts.openTask'),
                        onOpen: openTask,
                      });
                    }}
                    onOpen={openTask}
                  />
                );
              })}
            </ContactAssignmentsCard>
          ) : null}
          {enabledPlugins.has('teams') ? (
            <ContactAssignmentsCard
              title={t('contacts.relatedTeams')}
              icon={Users}
              iconPlugin="teams"
              isEmpty={teamAssignments.length === 0}
            >
              {teamAssignments.map(({ team, responsible }) => {
                const roleKey = RESPONSIBLE_ROLES.includes(responsible.role as any)
                  ? responsible.role
                  : 'other';
                const hasSeriesTeams = (team.series_teams ?? []).length > 0;
                const seriesLabel =
                  getSeriesTeamDisplayLabel(team, responsible.seriesTeam) ??
                  (hasSeriesTeams ? t('teams.form.seriesTeamAll') : null);
                const seriesColor = getSeriesTeamColorForName(team, responsible.seriesTeam);
                const title = formatTeamLabel(team) || team.name || 'Team';
                const roleBadge = {
                  label: t(`teams.roles.${roleKey}`),
                  className:
                    RESPONSIBLE_ROLE_BADGES[roleKey as keyof typeof RESPONSIBLE_ROLE_BADGES],
                };
                const openTeam = () => {
                  closeContactPanel();
                  setViewingAssignment(null);
                  navigate(`/teams/${buildSlug(team, teams, 'name')}`);
                };
                const details: AssignmentQuickInfoDetail[] = [
                  {
                    icon: User,
                    label: t('teams.form.statusLabel'),
                    value: t(`teams.status.${team.status}`),
                  },
                ];
                if (team.age_group?.trim()) {
                  details.push({
                    icon: Users,
                    label: t('teams.form.ageGroupLabel'),
                    value: team.age_group.trim(),
                  });
                }
                if (team.gender) {
                  details.push({
                    icon: Users,
                    label: t('teams.form.genderLabel'),
                    value: t(`teams.gender.${team.gender}`),
                  });
                }
                if (team.playing_format) {
                  details.push({
                    icon: Trophy,
                    label: t('teams.form.playingFormatLabel'),
                    value: team.playing_format,
                  });
                }
                return (
                  <ContactAssignmentRow
                    key={`${team.id}-${responsibleKey(responsible)}`}
                    title={title}
                    badges={[roleBadge]}
                    meta={
                      seriesLabel ? (
                        <SeriesTeamBadge label={seriesLabel} color={seriesColor} />
                      ) : null
                    }
                    actionLabel={t('contacts.openTeam')}
                    pluginClass="plugin-teams"
                    onTitleClick={() => {
                      setViewingAssignment({
                        title,
                        icon: Users,
                        badges: (
                          <>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                roleBadge.className,
                              )}
                            >
                              {roleBadge.label}
                            </span>
                            {seriesLabel ? (
                              <SeriesTeamBadge label={seriesLabel} color={seriesColor} />
                            ) : null}
                          </>
                        ),
                        details,
                        openLabel: t('contacts.openTeam'),
                        onOpen: openTeam,
                      });
                    }}
                    onOpen={openTeam}
                  />
                );
              })}
            </ContactAssignmentsCard>
          ) : null}
          {enabledPlugins.has('matches') ? (
            <RelatedItemsCard
              title="Matches"
              icon={Trophy}
              iconPlugin="matches"
              items={toMatchItems}
            />
          ) : null}
          {enabledPlugins.has('slots') ? (
            <ContactAssignmentsCard
              title={t('contacts.relatedSlots')}
              icon={Store}
              iconPlugin="slots"
              isEmpty={slots.length === 0}
            >
              {slots.map((item: any) => {
                const when = item.slot_time ? formatDateTime(item.slot_time) : null;
                const title =
                  (item.name && String(item.name).trim()) ||
                  item.location ||
                  t('contacts.relatedSlots');
                const rowBadges = when
                  ? [
                      {
                        label: when,
                        className:
                          'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
                      },
                    ]
                  : [];
                const openSlot = () => {
                  closeContactPanel();
                  setViewingAssignment(null);
                  navigate(
                    `/slots/${buildSlug(item, allSlots, (i) =>
                      i.slot_time ? String(i.slot_time).slice(0, 10) : '',
                    )}`,
                  );
                };
                const details: AssignmentQuickInfoDetail[] = [];
                if (item.location?.trim()) {
                  details.push({
                    icon: MapPin,
                    label: t('common.location'),
                    value: item.location.trim(),
                  });
                }
                if (when) {
                  details.push({
                    icon: CalendarDays,
                    label: t('common.time'),
                    value: when,
                  });
                }
                if (item.capacity != null) {
                  details.push({
                    icon: Users,
                    label: t('common.capacity'),
                    value: String(item.capacity),
                  });
                }
                return (
                  <ContactAssignmentRow
                    key={item.id}
                    title={title}
                    badges={rowBadges}
                    actionLabel={t('contacts.openSlot')}
                    pluginClass="plugin-slots"
                    onTitleClick={() => {
                      setViewingAssignment({
                        title,
                        icon: Store,
                        badges: rowBadges.map((badge) => (
                          <span
                            key={`${badge.label}-${badge.className ?? ''}`}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        )),
                        details,
                        openLabel: t('contacts.openSlot'),
                        onOpen: openSlot,
                      });
                    }}
                    onOpen={openSlot}
                  />
                );
              })}
            </ContactAssignmentsCard>
          ) : null}
          {enabledPlugins.has('estimates') ? (
            <ContactAssignmentsCard
              title={t('contacts.relatedEstimates')}
              icon={FileText}
              iconPlugin="estimates"
              isEmpty={relatedEstimates.length === 0}
            >
              {relatedEstimates.map((item: any) => {
                const title = formatDisplayNumber('estimates', item.estimateNumber);
                const statusKey = String(item.status || '');
                const statusLabel = statusKey ? formatEstimateStatusForDisplay(statusKey) : null;
                const statusColor =
                  statusKey in ESTIMATE_STATUS_COLORS
                    ? ESTIMATE_STATUS_COLORS[statusKey as keyof typeof ESTIMATE_STATUS_COLORS]
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                const rowBadges = statusLabel
                  ? [
                      {
                        label: statusLabel,
                        className: statusColor,
                      },
                    ]
                  : [];
                const openEstimate = () => {
                  closeContactPanel();
                  setViewingAssignment(null);
                  navigate(
                    `/estimates/${buildSlug(item, estimates.length > 0 ? estimates : relatedEstimates, 'estimateNumber')}`,
                  );
                };
                const details: AssignmentQuickInfoDetail[] = [];
                if (statusLabel) {
                  details.push({
                    icon: FileText,
                    label: t('estimates.fieldStatus'),
                    value: statusLabel,
                  });
                }
                if (item.validTo) {
                  const validTo = new Date(item.validTo);
                  if (Number.isFinite(validTo.getTime())) {
                    details.push({
                      icon: CalendarDays,
                      label: t('estimates.fieldValidTo'),
                      value: validTo.toLocaleDateString(),
                    });
                  }
                }
                return (
                  <ContactAssignmentRow
                    key={item.id}
                    title={title}
                    badges={rowBadges}
                    actionLabel={t('contacts.openEstimate')}
                    pluginClass="plugin-estimates"
                    onTitleClick={() => {
                      setViewingAssignment({
                        title,
                        icon: FileText,
                        badges: rowBadges.map((badge) => (
                          <span
                            key={`${badge.label}-${badge.className ?? ''}`}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        )),
                        details,
                        openLabel: t('contacts.openEstimate'),
                        onOpen: openEstimate,
                      });
                    }}
                    onOpen={openEstimate}
                  />
                );
              })}
            </ContactAssignmentsCard>
          ) : null}
        </div>
      </DetailLayout>

      <AssignmentQuickInfoDialog
        isOpen={viewingAssignment !== null}
        title={viewingAssignment?.title ?? ''}
        icon={viewingAssignment?.icon ?? Users}
        badges={viewingAssignment?.badges}
        details={viewingAssignment?.details ?? []}
        openLabel={viewingAssignment?.openLabel ?? t('common.open')}
        onClose={() => setViewingAssignment(null)}
        onOpen={() => {
          viewingAssignment?.onOpen();
        }}
      />

      <ConfirmDialog
        isOpen={showDiscardTagsDialog}
        title={t('dialog.unsavedChanges')}
        message={t('contacts.discardTagsMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardTagsAndClose}
        onCancel={() => setShowDiscardTagsDialog(false)}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmDeleteEntryId !== null}
        title={t('contacts.deleteTimeEntryTitle')}
        message={t('contacts.deleteTimeEntryMessage')}
        confirmText={t('contacts.delete')}
        cancelText={t('contacts.cancel')}
        onConfirm={async () => {
          if (confirmDeleteEntryId) {
            await handleDeleteTimeEntry(confirmDeleteEntryId);
          }
          setConfirmDeleteEntryId(null);
        }}
        onCancel={() => setConfirmDeleteEntryId(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteContactConfirm}
        title={t('dialog.deleteItem', { label: t('nav.contact') })}
        message={contact ? getDeleteMessage(contact) : ''}
        confirmText={t('contacts.delete')}
        cancelText={t('contacts.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteContactConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(contact, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedContactId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('contacts.title')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />

      <BulkMessageDialog
        isOpen={showSendMessageDialog}
        onClose={closeSendMessageDialog}
        recipients={sendMessageRecipients}
        pluginSource="contacts"
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="contacts"
      />
    </>
  );
});
