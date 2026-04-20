import {
  CheckSquare,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Mail,
  MapPin,
  Phone,
  SlidersHorizontal,
  Star,
  StickyNote,
  Store,
  Tag,
  Trash2,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';

interface ContactViewProps {
  contact: Contact;
}

/* -------------------------------------------------------------------------
   Design tokens mapped to Tailwind classes (from homebase-contact guide)
   ------------------------------------------------------------------------- */
const CARD_CLASS = 'rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950';
const FIELD_LABEL_CLASS =
  'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-400 dark:text-slate-500 mb-0.5';
const FIELD_LABEL_ICON_CLASS = 'h-3 w-3 shrink-0';
const FIELD_VALUE_CLASS = 'text-[14px] font-medium text-foreground';
const PROP_ROW_CLASS =
  'flex items-center justify-between py-3 border-b border-border/50 last:border-0';
const NOTE_CLASS =
  'flex items-start gap-3 p-3.5 rounded-md border-l-4 border-amber-400 bg-amber-50/70 mt-4 dark:bg-amber-950/20 dark:border-amber-600';
const EMPTY_STATE_CLASS =
  'text-center border border-dashed border-border rounded-lg p-8 bg-muted/30 mt-3';
const INFO_ROW_CLASS =
  'flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs';
const SURFACE_ROW_CLASS =
  'flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 dark:bg-muted/25';

type RelatedItem = { id: string | number; label: string; onOpen: () => void; pluginClass: string };

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
  const actionRowClass =
    'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted/50 transition-colors';

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
  const actionRowClass =
    'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted/50 transition-colors';
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
  iconPlugin: string;
  items: RelatedItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection title={title} icon={Icon} iconPlugin={iconPlugin} subtleTitle className="p-4">
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={`${title}-${item.id}`} className={cn(SURFACE_ROW_CLASS, item.pluginClass)}>
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={ExternalLink}
                className="h-7 w-7 shrink-0 p-0 hover:bg-accent"
                onClick={item.onOpen}
              >
                <span className="sr-only">Open</span>
              </Button>
            </div>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}

export const ContactView = React.memo(function ContactView({ contact }: ContactViewProps) {
  const { t } = useTranslation();
  const {
    user,
    getNotesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
    getSlotsForContact,
    getMatchesForContact,
    openNoteForView,
    openTaskForView,
    openEstimateForView,
    openSlotForView,
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
  } = useContacts();

  const [mentionedInNotes, setMentionedInNotes] = useState<any[]>([]);
  const [relatedEstimates, setRelatedEstimates] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [mentionedInTasks, setMentionedInTasks] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [matchMatches, setMatchMatches] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<
    { id: string; seconds: number; loggedAt: string }[]
  >([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  const [showDeleteContactConfirm, setShowDeleteContactConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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
    void getTasksWithMentionsForContact(contact.id)
      .then(setMentionedInTasks)
      .catch(() => setMentionedInTasks([]));
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
    getTasksWithMentionsForContact,
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

  const toEstimateItems: RelatedItem[] = useMemo(
    () =>
      relatedEstimates.map((item: any) => ({
        id: item.id,
        label: formatDisplayNumber('estimates', item.estimateNumber),
        onOpen: () => {
          closeContactPanel();
          openEstimateForView(item);
        },
        pluginClass: 'plugin-estimates bg-plugin-subtle/40',
      })),
    [relatedEstimates, closeContactPanel, openEstimateForView],
  );

  const toTaskItems: RelatedItem[] = useMemo(
    () =>
      [...assignedTasks, ...mentionedInTasks].map((item: any) => ({
        id: item.id,
        label: item.title || 'Task',
        onOpen: () => {
          closeContactPanel();
          openTaskForView(item);
        },
        pluginClass: 'plugin-tasks bg-plugin-subtle/40',
      })),
    [assignedTasks, mentionedInTasks, closeContactPanel, openTaskForView],
  );

  const toNoteItems: RelatedItem[] = useMemo(
    () =>
      mentionedInNotes.map((item: any) => ({
        id: item.id,
        label: item.title || 'Note',
        onOpen: () => {
          closeContactPanel();
          openNoteForView(item);
        },
        pluginClass: 'plugin-notes bg-plugin-subtle/40',
      })),
    [mentionedInNotes, closeContactPanel, openNoteForView],
  );

  const toSlotItems: RelatedItem[] = useMemo(
    () =>
      slots.map((item: any) => ({
        id: item.id,
        label: item.location || 'Slot',
        onOpen: () => {
          closeContactPanel();
          openSlotForView(item);
        },
        pluginClass: 'plugin-slots bg-plugin-subtle/40',
      })),
    [slots, closeContactPanel, openSlotForView],
  );

  const toMatchItems: RelatedItem[] = useMemo(
    () =>
      matchMatches.map((item: any) => ({
        id: item.id,
        label: `${item.home_team ?? '—'} - ${item.away_team ?? '—'}`,
        onOpen: () => {
          closeContactPanel();
          openMatchForView(item);
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

            <RelatedItemsCard
              title="Tasks"
              icon={CheckSquare}
              iconPlugin="tasks"
              items={toTaskItems}
            />
            <RelatedItemsCard
              title="Estimates"
              icon={FileText}
              iconPlugin="estimates"
              items={toEstimateItems}
            />
            <RelatedItemsCard
              title="Note Mentions"
              icon={StickyNote}
              iconPlugin="notes"
              items={toNoteItems}
            />
            {user?.plugins?.includes('slots') && (
              <RelatedItemsCard title="Slots" icon={Store} iconPlugin="slots" items={toSlotItems} />
            )}
            {user?.plugins?.includes('matches') && (
              <RelatedItemsCard
                title="Matches"
                icon={Trophy}
                iconPlugin="matches"
                items={toMatchItems}
              />
            )}

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
                          'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                          isCompany
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {isCompany ? 'Company' : 'Private'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>Organization Number</div>
                    <div className={FIELD_VALUE_CLASS}>{contact.organizationNumber || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>VAT Number</div>
                    <div className={FIELD_VALUE_CLASS}>{contact.vatNumber || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Mail className={FIELD_LABEL_ICON_CLASS} />
                      Email
                    </div>
                    <div className={FIELD_VALUE_CLASS}>{contact.email || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Globe className={FIELD_LABEL_ICON_CLASS} />
                      Website
                    </div>
                    <div className={FIELD_VALUE_CLASS}>{contact.website || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Phone className={FIELD_LABEL_ICON_CLASS} />
                      Phone 1
                    </div>
                    <div className={FIELD_VALUE_CLASS}>{contact.phone || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>
                      <Phone className={FIELD_LABEL_ICON_CLASS} />
                      Phone 2
                    </div>
                    <div className={FIELD_VALUE_CLASS}>{contact.phone2 || '—'}</div>
                  </div>
                </div>

                {/* Notes — amber left-border callout */}
                {contact.notes ? (
                  <div className={NOTE_CLASS}>
                    <Star className="h-4 w-4 mt-0.5 text-amber-500 fill-amber-400 shrink-0 dark:text-amber-400" />
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] font-semibold text-amber-800 dark:text-amber-400">
                        Notes
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-amber-950 dark:text-amber-200">
                        {contact.notes}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </DetailSection>
          </Card>

          {/* Contact Properties — divider list with colored pills */}
          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={t('contacts.contactProperties')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-6"
            >
              <div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Tax rate</span>
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {contact.taxRate ? `${contact.taxRate}%` : '—'}
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
                {/* Tags row */}
                <div className="pt-3">
                  <div className={FIELD_LABEL_CLASS}>Tags</div>
                  {Array.isArray(contact.tags) && contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {contact.tags.map((item: string) => (
                        <Badge
                          key={item}
                          className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1 text-xs"
                        >
                          <Tag className="h-3 w-3" />
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground mt-1 block">No tags</span>
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
                            <div className={FIELD_VALUE_CLASS}>{address.email}</div>
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
                                <div className={FIELD_VALUE_CLASS}>{person.email}</div>
                              </div>
                            )}
                            {person.phone && (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Phone</div>
                                <div className={FIELD_VALUE_CLASS}>{person.phone}</div>
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
        </div>
      </DetailLayout>

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
