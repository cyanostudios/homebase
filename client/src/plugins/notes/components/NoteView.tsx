import { Copy, Edit, Info, Trash2, Users, Zap } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import type { Note } from '@/plugins/notes/types/notes';

const NOTE_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

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
    <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
      <DetailSection title={t('notes.quickActions')} icon={Zap} iconPlugin="notes" className="p-4">
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Edit}
            className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted"
            onClick={() => onEdit(note)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Copy}
              className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted"
              onClick={() => onDuplicate(note)}
            >
              {t('common.duplicate')}
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
                  icon={Icon}
                  disabled={action.disabled}
                  className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted disabled:opacity-50"
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

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { t } = useTranslation();
  const { openContactForView } = useContacts();
  const {
    closeNotePanel,
    deleteNote,
    openNoteForEdit,
    getDuplicateConfig,
    executeDuplicate,
    detailFooterActions,
    getDeleteMessage,
  } = useNotes();

  const handleConfirmDelete = async () => {
    if (note) {
      await deleteNote(note.id);
      setShowDeleteNoteConfirm(false);
      closeNotePanel();
    }
  };
  const { refreshData } = useApp();

  const [contactsData, setContactsData] = useState<any[]>([]);
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);

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
          mainClassName="max-w-[920px]"
          sidebar={
            <div className="space-y-4">
              <NoteQuickActionsCard
                note={note}
                onEdit={openNoteForEdit}
                onDeleteClick={() => setShowDeleteNoteConfirm(true)}
                onDuplicate={(n) => executeDuplicate(n, '')}
                getDuplicateConfig={getDuplicateConfig}
                detailFooterActions={detailFooterActions}
              />
              {note.mentions && note.mentions.length > 0 && (
                <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
                  <DetailSection
                    title={t('notes.mentionedContacts')}
                    icon={Users}
                    iconPlugin="contacts"
                    className="p-4"
                  >
                    <div className="space-y-2">
                      {(() => {
                        // De-duplicate mentions by contactId
                        const uniqueMentions = Array.from(
                          new Map((note.mentions || []).map((m: any) => [m.contactId, m])).values(),
                        );

                        return uniqueMentions.map((mention: any) => {
                          const contactData = contactsData.find(
                            (c: any) => c.id === mention.contactId,
                          );

                          const getDisplayText = () => {
                            if (!contactData) {
                              const contactNumber = formatDisplayNumber(
                                'contacts',
                                mention.contactId,
                              );
                              const name = mention.contactName;
                              return `${contactNumber} • ${name} (deleted)`;
                            }

                            const contactNumber = formatDisplayNumber(
                              'contacts',
                              contactData.contactNumber || contactData.id,
                            );
                            const name = mention.contactName;
                            const orgPersonNumber =
                              contactData.organizationNumber || contactData.personalNumber || '';

                            return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                          };

                          return (
                            <div
                              key={`mention-${mention.contactId}`}
                              className="flex justify-between items-center text-[11px] plugin-contacts bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                            >
                              <span className="text-muted-foreground truncate mr-4">
                                {getDisplayText()}
                              </span>
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() =>
                                  contactData ? handleContactClick(mention.contactId) : null
                                }
                                disabled={!contactData}
                                className={cn(
                                  'h-auto p-0 text-[10px] shrink-0 font-medium',
                                  contactData ? 'text-plugin' : 'text-muted-foreground',
                                )}
                              >
                                {contactData ? 'View' : 'Deleted'}
                              </Button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </DetailSection>
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
            </div>
          }
        >
          <div className="space-y-6">
            <Card padding="none" className={NOTE_DETAIL_CARD_CLASS}>
              <DetailSection title={t('notes.noteContent')} iconPlugin="notes" className="p-6">
                <RichTextContent
                  content={note.content}
                  mentions={note.mentions || []}
                  onMentionClick={handleContactClick}
                />
              </DetailSection>
            </Card>
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
    </>
  );
};
