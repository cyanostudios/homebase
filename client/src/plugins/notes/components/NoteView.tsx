import { Edit, Link2, Maximize2, Minimize2, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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

import { NoteShareBlock } from './NoteShareBlock';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const { closeNotePanel, openNoteForEdit } = useNotes();
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setFocusMode(false);
  }, [note?.id]);

  useEffect(() => {
    if (!focusMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

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

  const focusModeToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={focusMode ? Minimize2 : Maximize2}
      className={DETAIL_ENTITY_LINK_TRIGGER_CLASS}
      aria-pressed={focusMode}
      title={t('notes.focusModeHint')}
      onClick={() => setFocusMode((open) => !open)}
    >
      {focusMode ? t('notes.exitFocusMode') : t('notes.focusMode')}
    </Button>
  );

  const contentHeaderActions = (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={Edit}
        className="h-8 w-8 shrink-0 p-0 hidden md:inline-flex"
        onClick={() => openNoteForEdit(note)}
        aria-label={t('common.edit')}
        title={t('common.edit')}
      />
      {focusModeToggle}
    </div>
  );

  const noteContent = (
    <RichTextContent
      content={note.content}
      mentions={note.mentions || []}
      onMentionClick={handleContactClick}
    />
  );

  const updatedLabel = note.updatedAt
    ? new Date(note.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const contentColumn = (
    <Card
      padding="none"
      className={cn(
        DETAIL_VIEW_CARD_CLASS,
        'min-w-0 overflow-x-hidden',
        focusMode && 'relative z-50 mx-auto w-full max-w-[1080px] shadow-lg',
      )}
    >
      {note.showTitleInContent !== false ? (
        <DetailSection
          title={(note.title || '').trim() || '—'}
          iconPlugin="notes"
          className="min-w-0 overflow-x-hidden p-6"
          prominentTitle
          action={contentHeaderActions}
        >
          {updatedLabel ? (
            <p className="mb-3 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}
          <div
            className={cn(
              'min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden',
              focusMode && 'min-h-[min(70vh,560px)]',
            )}
          >
            {noteContent}
          </div>
        </DetailSection>
      ) : (
        <div className="min-w-0 overflow-x-hidden p-6">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {updatedLabel ? (
                <p className="text-xs text-muted-foreground">
                  {t('common.updated')} {updatedLabel}
                </p>
              ) : null}
            </div>
            {contentHeaderActions}
          </div>
          <div
            className={cn(
              'min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden',
              focusMode && 'min-h-[min(70vh,560px)]',
            )}
          >
            {noteContent}
          </div>
        </div>
      )}
    </Card>
  );

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
      {focusMode ? (
        <button
          type="button"
          aria-label={t('notes.exitFocusMode')}
          className="fixed inset-0 z-40 cursor-default border-0 bg-slate-950/55 p-0"
          onClick={() => setFocusMode(false)}
        />
      ) : null}

      <DetailLayout>
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          {contentColumn}
          {!focusMode ? (
            <>
              {hasFilesPlugin ? (
                <FileAttachmentsSection pluginName="notes" entityId={note.id} readOnly />
              ) : null}
              {mentionsCard}
              <NoteShareBlock note={note} />
            </>
          ) : null}
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
};
