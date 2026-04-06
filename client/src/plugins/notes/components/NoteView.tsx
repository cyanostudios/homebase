import { Copy, Download, Edit, ExternalLink, Info, Trash2, Users, Zap } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import type { Note } from '@/plugins/notes/types/notes';

const NOTE_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

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
  if (actionId === 'create-task-from-note-and-delete') {
    return 'text-amber-600 dark:text-amber-400';
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
  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';
  return (
    <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
      <DetailSection title={t('notes.quickActions')} icon={Zap} iconPlugin="notes" className="p-4">
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
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
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
              className={quickActionButtonClass}
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
                  className={cn(quickActionButtonClass, 'disabled:opacity-50', action.className)}
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
}

function NoteExportOptionsCard({ note, exportFormats, onExportItem }: NoteExportOptionsCardProps) {
  const { t } = useTranslation();
  if (exportFormats.length === 0) {
    return null;
  }

  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';
  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('notes.exportOptions')}
        icon={Download}
        iconPlugin="notes"
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
              onClick={() => onExportItem(format, note)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { t } = useTranslation();
  const { openContactForView } = useContacts();
  const {
    closeNotePanel,
    deleteNote,
    openNoteForEdit,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedNoteId,
    detailFooterActions,
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
  const { refreshData, user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

  const [contactsData, setContactsData] = useState<any[]>([]);
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  useEffect(() => {
    const fetchContactsData = async () => {
      try {
        const response = await fetch('/api/contacts', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setContactsData(data);
        }
      } catch (error) {
        console.error('Failed to load contacts data:', error);
      }
    };

    if (note?.mentions && note.mentions.length > 0) {
      fetchContactsData();
    }
  }, [note?.mentions]);

  const handleContactClick = async (contactId: string) => {
    await refreshData();

    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include',
      });

      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);

        if (contact) {
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };

          closeNotePanel();
          openContactForView(transformedContact);
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  const uniqueMentions = useMemo(
    () =>
      Array.from(
        new Map(
          (note?.mentions || []).map((m: { contactId: string }) => [m.contactId, m]),
        ).values(),
      ),
    [note?.mentions],
  );

  if (!note) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'plugin-notes min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout
          mainClassName={PANEL_MAX_WIDTH}
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
              />
              {note.mentions && note.mentions.length > 0 && (
                <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
                  <div className="space-y-1.5 p-3 sm:p-4">
                    <div className="mb-0.5 flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {t('notes.mentionedContacts')}
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-0">
                      {uniqueMentions.map(
                        (mention: { contactId: string; contactName?: string }) => {
                          const contactData = contactsData.find(
                            (c: { id: string | number }) =>
                              String(c.id) === String(mention.contactId),
                          ) as { id: string; companyName?: string } | undefined;

                          const name =
                            contactData?.companyName ?? mention.contactName ?? mention.contactId;

                          return (
                            <div
                              key={`mention-${mention.contactId}`}
                              className="rounded-lg border border-border px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="truncate text-sm font-medium">{name}</span>
                                </div>
                                <div className="shrink-0">
                                  {contactData ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      icon={ExternalLink}
                                      className="h-9 w-9 shrink-0 p-0 plugin-contacts text-plugin hover:bg-accent"
                                      onClick={() => handleContactClick(mention.contactId)}
                                      aria-label={`${t('common.open')} ${name}`}
                                    >
                                      <span className="sr-only">{t('common.open')}</span>
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
                <DetailSection
                  title={t('notes.information')}
                  icon={Info}
                  iconPlugin="notes"
                  className="p-4"
                >
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono font-medium">
                        {formatDisplayNumber('notes', note.id)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-medium">
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
            <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
              <DetailSection
                title={(note.title || '').trim() || '—'}
                iconPlugin="notes"
                className="p-6"
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
          </div>
        </DetailLayout>
      </div>

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
