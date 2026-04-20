import {
  CheckSquare,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Info,
  SlidersHorizontal,
  StickyNote,
  Store,
  Tag,
  Trash2,
  Trophy,
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

const CONTACT_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';
const FIELD_LABEL_CLASS =
  'text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5';

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
  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

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
    <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('contacts.quickActions')}
        icon={Zap}
        iconPlugin="contacts"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
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
            className={quickActionButtonClass}
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
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
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
              className={quickActionButtonClass}
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
                  className={cn(quickActionButtonClass, 'disabled:opacity-50', action.className)}
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
  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';
  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('contacts.exportTxt'),
    csv: t('contacts.exportCsv'),
    pdf: t('contacts.exportPdf'),
  };

  return (
    <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('contacts.exportOptions')}
        icon={Download}
        iconPlugin="contacts"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={quickActionButtonClass}
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
    <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
      <DetailSection title={title} icon={Icon} iconPlugin={iconPlugin} className="p-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item.id}`}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2',
                item.pluginClass,
              )}
            >
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={ExternalLink}
                className="h-9 w-9 shrink-0 p-0 hover:bg-accent"
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
    const loadTimeEntries = async () => {
      try {
        const response = await apiFetch(`/api/contacts/${contact.id}/time-entries`);
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

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-6">
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

            <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
              <DetailSection title={t('contacts.information')} icon={Info} className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono font-medium">
                      {formatDisplayNumber('contacts', contact.id)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
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
        <div className="space-y-6">
          <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
            <DetailSection
              title={t('contacts.contactContent')}
              iconPlugin="contacts"
              className="p-6"
            >
              <div className="space-y-5">
                <div>
                  <div className={FIELD_LABEL_CLASS}>Name</div>
                  <div className="text-2xl font-semibold text-foreground">
                    {contact.companyName || '—'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={FIELD_LABEL_CLASS}>Contact #</div>
                    <div className="text-sm font-medium">{contact.contactNumber || '—'}</div>
                  </div>
                  <div>
                    <div className={FIELD_LABEL_CLASS}>Type</div>
                    <div className="text-sm font-medium">
                      {contact.contactType === 'company' ? 'Company' : 'Private'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Organization Number
                    </div>
                    <div className="text-sm font-medium">{contact.organizationNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      VAT Number
                    </div>
                    <div className="text-sm font-medium">{contact.vatNumber || '—'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Email
                    </div>
                    <div className="text-sm font-medium">{contact.email || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Website
                    </div>
                    <div className="text-sm font-medium">{contact.website || '—'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Phone 1
                    </div>
                    <div className="text-sm font-medium">{contact.phone || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Phone 2
                    </div>
                    <div className="text-sm font-medium">{contact.phone2 || '—'}</div>
                  </div>
                </div>
                {contact.notes ? (
                  <div className="border-t border-border pt-5">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                      Notes
                    </div>
                    <div className="text-sm text-muted-foreground">{contact.notes}</div>
                  </div>
                ) : null}
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
            <div className="space-y-2 p-6">
              <div className="mb-1 flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {t('contacts.contactProperties')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Tax rate</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {contact.taxRate || '—'}%
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Payment terms</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {contact.paymentTerms || '—'} days
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Currency</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {contact.currency || '—'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">F-tax</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {contact.fTax === 'yes' ? 'Registered' : 'No'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Assignable</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {contact.isAssignable ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 md:col-span-2">
                  <div className="text-sm font-medium mb-2">Tags</div>
                  {Array.isArray(contact.tags) && contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.map((item: string) => (
                        <Badge
                          key={item}
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                        >
                          <Tag className="h-3 w-3" />
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {Array.isArray(contact.addresses) && contact.addresses.length > 0 && (
            <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
              <DetailSection title="Addresses" className="p-6">
                <div className="space-y-5">
                  {contact.addresses.map((address: any, idx: number) => (
                    <div
                      key={address.id}
                      className={cn('space-y-5', idx > 0 && 'border-t border-border pt-5')}
                    >
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                          Type
                        </div>
                        <div className="text-2xl font-semibold text-foreground">
                          {address.type || 'Address'}
                        </div>
                      </div>
                      {address.addressLine1 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                            Address
                          </div>
                          <div className="text-sm font-medium">
                            {[address.addressLine1, address.addressLine2]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {(address.postalCode || address.city) && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Postal Code / City
                            </div>
                            <div className="text-sm font-medium">
                              {[address.postalCode, address.city].filter(Boolean).join(' ')}
                            </div>
                          </div>
                        )}
                        {address.region && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Region
                            </div>
                            <div className="text-sm font-medium">{address.region}</div>
                          </div>
                        )}
                        {address.country && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Country
                            </div>
                            <div className="text-sm font-medium">{address.country}</div>
                          </div>
                        )}
                        {address.email && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Email
                            </div>
                            <div className="text-sm font-medium">{address.email}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          {Array.isArray(contact.contactPersons) && contact.contactPersons.length > 0 && (
            <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
              <DetailSection title="Contact Persons" className="p-6">
                <div className="space-y-5">
                  {contact.contactPersons.map((person: any, idx: number) => (
                    <div
                      key={person.id}
                      className={cn('space-y-5', idx > 0 && 'border-t border-border pt-5')}
                    >
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                          Name
                        </div>
                        <div className="text-2xl font-semibold text-foreground">
                          {person.name || '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {person.title && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Title
                            </div>
                            <div className="text-sm font-medium">{person.title}</div>
                          </div>
                        )}
                        {person.email && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Email
                            </div>
                            <div className="text-sm font-medium">{person.email}</div>
                          </div>
                        )}
                        {person.phone && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Phone
                            </div>
                            <div className="text-sm font-medium">{person.phone}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className={CONTACT_DETAIL_CARD_CLASS}>
            <DetailSection title="Time log" icon={Clock} className="p-4">
              <div className="space-y-2">
                {timeEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No time entries</p>
                ) : (
                  timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-xs text-foreground">
                        {formatDuration(entry.seconds)} -{' '}
                        {new Date(entry.loggedAt).toLocaleDateString()}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => setConfirmDeleteEntryId(entry.id)}
                        disabled={deletingEntryId === entry.id}
                      >
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </Card>
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
