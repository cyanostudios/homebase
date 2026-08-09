import { Copy, Download, Edit, Info, Trash2, Users, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { buildSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';
import { ContactAssignmentRow } from '@/plugins/contacts/components/ContactAssignmentRow';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import type { Note } from '@/plugins/notes/types/notes';

import { NoteShareBlock } from './NoteShareBlock';

interface NoteQuickActionsCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDeleteClick: () => void;
  onDuplicate: (note: Note) => void;
  getDuplicateConfig: (
    item: Note | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function getQuickActionIconColorClass(actionId: string): string {
  if (actionId === 'send-message') {
    return 'text-violet-600 dark:text-violet-400';
  }
  if (actionId === 'send-email') {
    return 'text-red-600 dark:text-red-400';
  }
  if (actionId === 'create-task-from-note') {
    return 'text-green-600 dark:text-green-400';
  }
  return '';
}

function getExportShareIconColorClass(actionId: string): string {
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

function NoteQuickActionsCard({
  note,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
}: NoteQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(note));
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('notes.quickActions')}
        icon={Zap}
        iconPlugin="notes"
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
            className={DETAIL_QUICK_ACTION_ROW_CLASS}
            onClick={() => onEdit(note)}
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
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={() => onDuplicate(note)}
            >
              {t('common.duplicate')}
            </Button>
          )}
          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              const iconTint = getQuickActionIconColorClass(action.id);
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                  disabled={action.disabled}
                  className={cn(
                    DETAIL_QUICK_ACTION_ROW_CLASS,
                    'disabled:opacity-50',
                    action.className,
                  )}
                  onClick={() => action.onClick(note)}
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

interface NoteViewProps {
  note: any;
}

interface NoteExportOptionsCardProps {
  note: Note;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Note) => void;
  shareActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function NoteExportOptionsCard({
  note,
  exportFormats,
  onExportItem,
  shareActions,
}: NoteExportOptionsCardProps) {
  const { t } = useTranslation();
  const hasShareButtons = Array.isArray(shareActions) && shareActions.length > 0;
  if (exportFormats.length === 0 && !hasShareButtons) {
    return null;
  }

  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('notes.exportOptions')}
        icon={Download}
        iconPlugin="notes"
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
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={() => onExportItem(format, note)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
          {hasShareButtons ? (
            <>
              {exportFormats.length > 0 ? (
                <div className="w-full border-t border-border/60 pt-2 mt-0.5" />
              ) : null}
              {shareActions!.map((action) => {
                const Icon = action.icon;
                const iconTint = getExportShareIconColorClass(action.id);
                return (
                  <Button
                    key={action.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                    disabled={action.disabled}
                    className={cn(
                      DETAIL_QUICK_ACTION_ROW_CLASS,
                      'disabled:opacity-50',
                      action.className,
                    )}
                    onClick={() => action.onClick(note)}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const {
    closeNotePanel,
    deleteNote,
    openNoteForEdit,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedNoteId,
    detailFooterActions,
    exportShareActions,
    exportFormats,
    onExportItem,
    getDeleteMessage,
  } = useNotes();

  const handleConfirmDelete = async () => {
    if (note) {
      await deleteNote(note.id);
      setShowDeleteNoteConfirm(false);
      closeNotePanel();
    }
  };
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);

  const navigateToContact = (contact: Contact) => {
    closeNotePanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const handleContactClick = (contactId: string) => {
    const contact = contactById.get(String(contactId));
    if (!contact) {
      return;
    }
    setViewingContact(contact);
  };

  const openMentionContact = (contactId: string) => {
    const contact = contactById.get(String(contactId));
    if (!contact) {
      return;
    }
    navigateToContact(contact);
  };

  const uniqueMentions = useMemo((): Array<{ contactId: string; contactName?: string }> => {
    const raw = (note?.mentions || []) as Array<{ contactId: string; contactName?: string }>;
    return Array.from(new Map(raw.map((m) => [m.contactId, m])).values());
  }, [note?.mentions]);

  if (!note) {
    return null;
  }

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <NoteQuickActionsCard
              note={note}
              onEdit={openNoteForEdit}
              onDeleteClick={() => setShowDeleteNoteConfirm(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
              detailFooterActions={detailFooterActions}
            />
            <NoteExportOptionsCard
              note={note}
              exportFormats={exportFormats}
              onExportItem={onExportItem}
              shareActions={exportShareActions}
            />

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('notes.information')}
                icon={Info}
                iconPlugin="notes"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('notes', note.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="note"
              entityId={note.id}
              limit={30}
              title={t('notes.activity')}
              showClearButton
              refreshKey={String(note.updatedAt ?? note.id)}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={(note.title || '').trim() || '—'}
              iconPlugin="notes"
              className="p-6"
              prominentTitle
            >
              <RichTextContent
                content={note.content}
                mentions={note.mentions || []}
                onMentionClick={handleContactClick}
              />
            </DetailSection>
          </Card>

          {hasFilesPlugin ? (
            <FileAttachmentsSection pluginName="notes" entityId={note.id} readOnly />
          ) : null}

          {uniqueMentions.length > 0 ? (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('notes.mentionedContacts')}
                icon={Users}
                iconPlugin="contacts"
                subtleTitle
                className="p-4"
              >
                <div className="plugin-contacts space-y-2">
                  {uniqueMentions.map((mention) => {
                    const contactData = contactById.get(String(mention.contactId));
                    const name =
                      contactData?.companyName ?? mention.contactName ?? mention.contactId;
                    const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
                    const phone = contactData?.phone || contactData?.phone2;
                    const email = contactData?.email?.trim();

                    return (
                      <ContactAssignmentRow
                        key={`mention-${mention.contactId}`}
                        title={name}
                        badges={[
                          {
                            label: t(`contacts.type.${typeKey}`),
                            className:
                              typeKey === 'private'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                          },
                        ]}
                        meta={
                          <>
                            {phone ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {phone}
                              </span>
                            ) : null}
                            {email ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {email}
                              </span>
                            ) : null}
                          </>
                        }
                        actionLabel={t('notes.openContact')}
                        pluginClass="plugin-contacts"
                        onTitleClick={() => {
                          if (contactData) {
                            setViewingContact(contactData);
                          }
                        }}
                        onOpen={() => {
                          if (contactData) {
                            openMentionContact(mention.contactId);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </DetailSection>
            </Card>
          ) : null}

          <NoteShareBlock note={note} />
        </div>
      </DetailLayout>

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
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                viewingContact.contactType === 'private'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
              )}
            >
              {t(
                `contacts.type.${viewingContact.contactType === 'private' ? 'private' : 'company'}`,
              )}
            </span>
          ) : null
        }
      />

      <ConfirmDialog
        isOpen={showDeleteNoteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.note') })}
        message={note ? getDeleteMessage(note) : ''}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteNoteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(note, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedNoteId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(note)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(note)?.nameLabel ?? t('notes.title')}
        confirmOnly={Boolean(getDuplicateConfig(note)?.confirmOnly)}
      />
    </>
  );
};
