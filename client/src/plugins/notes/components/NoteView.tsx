import { Link2, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { buildSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { NoteQuickContextPanel } from './NoteQuickContextPanel';
import { NoteShareBlock } from './NoteShareBlock';

interface NoteViewProps {
  note: any;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const NoteView = React.memo(function NoteView({
  note,
  stacked: _stacked = false,
}: NoteViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const { closeNotePanel, openNoteForEdit } = useNotes();
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

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

  const uniqueMentions = useMemo((): Array<{ contactId: string; contactName?: string }> => {
    const raw = (note?.mentions || []) as Array<{ contactId: string; contactName?: string }>;
    return Array.from(new Map(raw.map((m) => [m.contactId, m])).values());
  }, [note?.mentions]);

  if (!note) {
    return null;
  }

  const mentionsCard =
    uniqueMentions.length > 0 ? (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={
            <span className="inline-flex items-baseline gap-2">
              <span>{t('notes.mentionedContacts')}</span>
              <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                {t('notes.quickContext.mentionsHint')}
              </span>
            </span>
          }
          icon={Link2}
          iconPlugin="contacts"
          subtleTitle
          className="p-6"
        >
          <QuickContextLinkTileGrid>
            {uniqueMentions.map((mention) => {
              const contactData = contactById.get(String(mention.contactId));
              const isDeleted = !contactData;
              const name = contactData?.companyName ?? mention.contactName ?? mention.contactId;
              const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
              return (
                <QuickContextLinkTile
                  key={`mention-${mention.contactId}`}
                  label={t('nav.contact')}
                  meta={isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)}
                  metaClassName={
                    isDeleted
                      ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : CONTACT_TYPE_COLORS[typeKey]
                  }
                  icon={Users}
                  iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                  onClick={
                    contactData
                      ? () => {
                          setViewingContact(contactData);
                        }
                      : undefined
                  }
                  className={isDeleted ? 'opacity-70' : undefined}
                >
                  {name}
                </QuickContextLinkTile>
              );
            })}
          </QuickContextLinkTileGrid>
        </DetailSection>
      </Card>
    ) : null;

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          <NoteQuickContextPanel note={note} onEdit={() => openNoteForEdit(note)} variant="full">
            <RichTextContent
              content={note.content}
              mentions={note.mentions || []}
              onMentionClick={handleContactClick}
            />
          </NoteQuickContextPanel>

          {hasFilesPlugin ? (
            <FileAttachmentsSection pluginName="notes" entityId={note.id} readOnly />
          ) : null}
          {mentionsCard}
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
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />
    </>
  );
});
