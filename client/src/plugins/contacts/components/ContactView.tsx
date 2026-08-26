import {
  Clock,
  Copy,
  Download,
  Edit,
  Info,
  Link2,
  MapPin,
  SlidersHorizontal,
  Tag,
  Trash2,
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
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS as FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS as FIELD_VALUE_CLASS,
  DETAIL_INFO_ROW_CLASS as INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS as CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { cn } from '@/lib/utils';

import { ContactCopyableLink, mailtoHref, telHref } from './ContactCopyableLink';
import { ContactLinkedItemsSection } from './ContactLinkedItemsSection';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';

interface ContactViewProps {
  contact: Contact;
}

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

export const ContactView = React.memo(function ContactView({ contact }: ContactViewProps) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();

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
    setContactAssignable,
  } = useContacts();

  const [timeEntries, setTimeEntries] = useState<
    { id: string; seconds: number; loggedAt: string }[]
  >([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  const [showDeleteContactConfirm, setShowDeleteContactConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
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

  if (!contact) {
    return null;
  }
  const duplicateConfig = getDuplicateConfig(contact);

  const isCompany = contact.contactType === 'company';
  const contactIdLabel = formatDisplayNumber('contacts', contact.id);

  return (
    <>
      <DetailLayout
        gridClassName="grid-cols-1 lg:grid-cols-[1.3fr_1fr_260px]"
        leftSidebar={
          <div className="space-y-4">
            <ContactQuickContextPanel
              contact={contact}
              availableTags={availableTags}
              onEdit={() => openContactForEdit(contact)}
              variant="full"
            />
            {Array.isArray(contact.addresses) && contact.addresses.length > 0 ? (
              <Card padding="none" className={CARD_CLASS}>
                <DetailSection title="Addresses" icon={MapPin} subtleTitle className="p-6">
                  <div className="space-y-6">
                    {contact.addresses.map((address: any, idx: number) => (
                      <div
                        key={address.id}
                        className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                      >
                        <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {address.type || 'Address'}
                        </Badge>
                        <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-4">
                          {address.addressLine1 ? (
                            <div className="col-span-2">
                              <div className={FIELD_LABEL_CLASS}>Address</div>
                              <div className={FIELD_VALUE_CLASS}>
                                {[address.addressLine1, address.addressLine2]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            </div>
                          ) : null}
                          {address.postalCode || address.city ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Postal Code / City</div>
                              <div className={FIELD_VALUE_CLASS}>
                                {[address.postalCode, address.city].filter(Boolean).join(' ')}
                              </div>
                            </div>
                          ) : null}
                          {address.region ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Region</div>
                              <div className={FIELD_VALUE_CLASS}>{address.region}</div>
                            </div>
                          ) : null}
                          {address.country ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Country</div>
                              <div className={FIELD_VALUE_CLASS}>{address.country}</div>
                            </div>
                          ) : null}
                          {address.email ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Email</div>
                              <ContactCopyableLink
                                value={address.email}
                                href={mailtoHref(address.email)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              </Card>
            ) : null}
          </div>
        }
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

            <Card
              padding="none"
              className={cn(
                CARD_CLASS,
                'border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/40',
              )}
            >
              <DetailSection title="Time log" icon={Clock} subtleTitle className="p-4">
                {timeEntries.length === 0 ? (
                  <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                    No time entries
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {timeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-amber-200/60 bg-amber-50/80 px-2.5 py-1.5 dark:border-amber-800/50 dark:bg-amber-950/50"
                      >
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
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
                className="p-5"
                collapsible
              >
                <div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {contactIdLabel}
                    </span>
                  </div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-extrabold text-foreground">
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
          {/* Contact Properties — label + value on one row, plain text */}
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
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {isCompany ? (contact.taxRate ? `${contact.taxRate}%` : '—') : '0%'}
                  </span>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Payment terms</span>
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {contact.paymentTerms ? `${contact.paymentTerms} days` : '—'}
                  </span>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Currency</span>
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {contact.currency || '—'}
                  </span>
                </div>
                {isCompany ? (
                  <div className={PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">F-tax</span>
                    <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                      {contact.fTax === 'yes' ? 'Registered' : 'No'}
                    </span>
                  </div>
                ) : null}
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Assignable</span>
                  <Select
                    value={contact.isAssignable ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      void setContactAssignable(contact, value === 'yes');
                    }}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t('contacts.assignableYes')}</SelectItem>
                      <SelectItem value="no">{t('contacts.assignableNo')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Tags row — draft edit; header Update calls onApplyTagsEdit */}
                <div className={cn(PROP_ROW_CLASS, 'items-start')}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Tags</span>
                  <div className="flex min-w-0 max-w-[70%] flex-col items-end gap-1.5">
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
                    {tagError ? <p className="text-xs text-destructive">{tagError}</p> : null}
                    {displayTags.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {displayTags.map((item: string) => (
                          <Badge
                            key={item}
                            variant="outline"
                            className="flex items-center gap-1 rounded-md border-border/60 bg-transparent text-xs font-medium text-foreground"
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
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

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
                        className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-extrabold text-slate-700 dark:from-slate-700 dark:to-slate-600 dark:text-slate-300">
                            {personInitials || <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold tracking-tight text-foreground leading-tight">
                              {person.name || '—'}
                            </div>
                            {person.title ? (
                              <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                {person.title}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {person.email || person.phone ? (
                          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8">
                            {person.email ? (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Email</div>
                                <ContactCopyableLink
                                  value={person.email}
                                  href={mailtoHref(person.email)}
                                />
                              </div>
                            ) : null}
                            {person.phone ? (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Phone</div>
                                <ContactCopyableLink
                                  value={person.phone}
                                  href={telHref(person.phone)}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={
                <span className="inline-flex items-baseline gap-2">
                  <span>{t('contacts.quickContext.linked')}</span>
                  <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                    {t('contacts.quickContext.linkedHint')}
                  </span>
                </span>
              }
              icon={Link2}
              subtleTitle
              className="p-6"
            >
              <ContactLinkedItemsSection
                contact={contact}
                previewLimit={null}
                showHeading={false}
                showHint={false}
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

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
